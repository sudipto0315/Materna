import requests
import json
from flask import Flask, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlite3
import datetime

app = Flask(__name__)
# Configuration for the RAG API
RAG_API_URL = "http://localhost:8000" 



# Add this new route to your existing Flask application (paste-2.txt)
@app.route('/generate-maternal-report', methods=['POST', 'OPTIONS'])
@jwt_required()
def generate_maternal_report():
    """
    Endpoint to generate a maternal health report by sending patient data to the RAG API.
    This should be added to your existing Flask application.
    """
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200
    
    # Get patient_id from the authenticated user
    patient_id = get_jwt_identity()
    
    try:
        # Fetch patient data from your SQLite database
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        
        # Get basic patient information
        c.execute("SELECT * FROM Patients WHERE patient_id = ?", (patient_id,))
        patient = c.fetchone()
        
        if not patient:
            return jsonify({'message': 'Patient not found'}), 404
        
        # Format patient data for the RAG API
        # This dictionary structure matches what the RAG system expects
        patient_data = {
            patient_id: {
                "personal_info": {
                    "first_name": patient[1],        # first_name
                    "last_name": patient[2],         # last_name
                    "gender": patient[3],            # gender
                    "dob": patient[4],               # dob
                    "blood_group": patient[17],      # blood_group
                    "height_cm": patient[10],        # height_cm
                    "current_weight": patient[12],   # current_weight
                    "pre_pregnancy_weight": patient[11], # pre_pregnancy_weight
                    "lmp": patient[13],              # lmp (last menstrual period)
                    "due_date": patient[14],         # due_date
                    "preexisting_conditions": ""     # Add if you have this data
                },
                "questionnaire": {
                    "is_first_pregnancy": "Yes" if patient[15] == 1 else "No",  # based on gravida
                    "exercise_frequency": "Unknown",  # Add if you have this data
                    "emotional_wellbeing": "Unknown", # Add if you have this data
                    "prenatal_vitamins": "Unknown"    # Add if you have this data
                }
            }
        }
        
        # Get medical reports for risk factors and test results
        c.execute("SELECT * FROM MedicalReports WHERE patient_id = ?", (patient_id,))
        reports = c.fetchall()
        conn.close()
        
        # Process any existing medical reports for risk data
        risk_factors = []
        test_results = []
        
        for report in reports:
            # The analysis_results is stored as a JSON string, parse it
            if report[7]:  # analysis_results column
                try:
                    analysis = json.loads(report[7])
                    
                    # Extract risk factors if present
                    if 'risk_factors' in analysis and isinstance(analysis['risk_factors'], list):
                        risk_factors.extend(analysis['risk_factors'])
                    
                    # Extract test results if present
                    if 'test_results' in analysis and isinstance(analysis['test_results'], list):
                        test_results.extend(analysis['test_results'])
                except json.JSONDecodeError:
                    pass  # Skip if JSON is invalid
        
        # Add risk factors and test results if available
        if risk_factors:
            patient_data[patient_id]['risk_factors'] = risk_factors
        
        if test_results:
            patient_data[patient_id]['test_results'] = test_results
        
        # Prepare the data for the RAG API request
        rag_request_data = {
            "patient_id": patient_id,
            "patient_data": patient_data
        }
        
        # Send request to the RAG API
        response = requests.post(
            f"{RAG_API_URL}/generate_report", 
            json=rag_request_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Check if the request was successful
        if response.status_code != 200:
            return jsonify({
                'message': 'Error from RAG system', 
                'error': response.json().get('detail', 'Unknown error')
            }), 500
        
        # Get the report from the RAG API response
        report_data = response.json()
        
        # Generate a unique report ID
        report_id = f"rag_{patient_id}_{int(datetime.datetime.now().timestamp())}"
        
        # Store the generated report in the database
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute('''INSERT INTO MedicalReports 
                     (report_id, patient_id, type, category, date, file_url, notes, analysis_results, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                 (report_id, patient_id, "RAG", "Maternal Health Assessment", 
                  datetime.datetime.now().isoformat(), "", 
                  "Automatically generated maternal health report", 
                  json.dumps({"report_content": report_data["report"]}),
                  datetime.datetime.now().isoformat()))
        conn.commit()
        conn.close()
        
        # Return the generated report and its ID
        return jsonify({
            'message': 'Report generated successfully',
            'report_id': report_id,
            'report': report_data['report']
        }), 201
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'message': f'Error generating report: {str(e)}'}), 500