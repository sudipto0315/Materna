from flask import Flask, request, jsonify
import sqlite3
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
import datetime
import uuid
import json

import requests
import json

app = Flask(__name__)

# JWT configuration
app.config['JWT_SECRET_KEY'] = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(hours=1)
jwt = JWTManager(app)

# Enable CORS with proper configuration
CORS(app, resources={r"/*": {
    "origins": "*",  # Allows all origins
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# Database setup
def init_db():
    conn = sqlite3.connect('hack.db')
    c = conn.cursor()
    # Users table with patient_id
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  username TEXT UNIQUE NOT NULL, 
                  password TEXT NOT NULL,
                  patient_id VARCHAR(50) UNIQUE NOT NULL)''')
    # Patients table with patient_id as foreign key
    c.execute('''CREATE TABLE IF NOT EXISTS Patients (
        patient_id VARCHAR(50) PRIMARY KEY,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        gender VARCHAR(10),
        dob DATE,
        contact_number BIGINT,
        email VARCHAR(100),
        address TEXT,
        emergency_contact VARCHAR(50),
        emergency_number BIGINT,
        height_cm INT,
        pre_pregnancy_weight FLOAT,
        current_weight FLOAT,
        lmp DATE,
        due_date DATE,
        gravida INT,
        para INT,
        blood_group VARCHAR(5),
        healthcare_provider VARCHAR(100),
        hospital VARCHAR(100),
        registration_date TIMESTAMP,
        last_updated TIMESTAMP
    )''')
    # MedicalReports table to store reports and analysis
    c.execute('''CREATE TABLE IF NOT EXISTS MedicalReports (
        report_id TEXT PRIMARY KEY,
        patient_id VARCHAR(50) NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        file_url TEXT NOT NULL,
       A notes TEXT,
        analysis_results TEXT,  -- Store JSON string of analysis results
        created_at TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES Patients(patient_id)
    )''')
    conn.commit()
    conn.close()

# Generate a unique patient ID
def generate_patient_id():
    return str(uuid.uuid4())[:8]

# Signup route
@app.route('/signup', methods=['POST', 'OPTIONS'])
def signup():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400

    hashed_password = generate_password_hash(password)
    patient_id = generate_patient_id()

    try:
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password, patient_id) VALUES (?, ?, ?)", 
                  (username, hashed_password, patient_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User created successfully', 'patient_id': patient_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({'message': 'Username already exists'}), 400

# Login route
@app.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    conn = sqlite3.connect('hack.db')
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()

    if user and check_password_hash(user[2], password):
        access_token = create_access_token(identity=user[3])
        return jsonify({'access_token': access_token, 'patient_id': user[3]}), 200
    return jsonify({'message': 'Invalid credentials'}), 401

# Register patient data
@app.route('/register-patient', methods=['POST', 'OPTIONS'])
@jwt_required()
def register_patient():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200

    patient_id = get_jwt_identity()
    data = request.get_json()
    print("Received data:", data)

    # Convert contact_number and emergency_number to integers
    try:
        contact_number = int(data.get('phoneNumber')) if data.get('phoneNumber') else None
    except (ValueError, TypeError):
        return jsonify({'message': 'Contact number must be a valid integer'}), 400

    try:
        emergency_number = int(data.get('emergencyPhone')) if data.get('emergencyPhone') else None
    except (ValueError, TypeError):
        return jsonify({'message': 'Emergency number must be a valid integer'}), 400

    # Convert height, weights, gravida, and para to appropriate types
    try:
        height_cm = int(data.get('height')) if data.get('height') is not None else None
        pre_pregnancy_weight = float(data.get('preWeight')) if data.get('preWeight') is not None else None
        current_weight = float(data.get('currentWeight')) if data.get('currentWeight') is not None else None
        gravida = int(data.get('gravida')) if data.get('gravida') is not None else None
        para = int(data.get('para')) if data.get('para') is not None else None
    except (ValueError, TypeError):
        return jsonify({'message': 'Height, weights, gravida, and para must be valid numbers'}), 400

    patient_data = {
        'patient_id': patient_id,
        'first_name': data.get('firstName'),
        'last_name': data.get('lastName'),
        'email': data.get('email'),
        'contact_number': contact_number,
        'dob': data.get('dob'),
        'gender': data.get('gender'),
        'address': data.get('address'),
        'emergency_contact': data.get('emergencyContact'),
        'emergency_number': emergency_number,
        'height_cm': height_cm,
        'pre_pregnancy_weight': pre_pregnancy_weight,
        'current_weight': current_weight,
        'blood_group': data.get('bloodGroup'),
        'lmp': data.get('lmp'),
        'due_date': data.get('dueDate'),
        'healthcare_provider': data.get('primaryProvider'),
        'hospital': data.get('preferredHospital'),
        'gravida': gravida,
        'para': para,
        'registration_date': datetime.datetime.now().isoformat(),
        'last_updated': datetime.datetime.now().isoformat()
    }

    print("Patient data to insert:", patient_data)

    if not all([patient_data['first_name'], patient_data['last_name'], patient_data['email'], patient_data['lmp']]):
        return jsonify({'message': 'Missing required fields'}), 400

    try:
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute('''INSERT OR REPLACE INTO Patients 
                     (patient_id, first_name, last_name, gender, dob, contact_number, email, address, 
                      emergency_contact, emergency_number, height_cm, pre_pregnancy_weight, current_weight, 
                      lmp, due_date, gravida, para, blood_group, healthcare_provider, hospital, 
                      registration_date, last_updated) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  tuple(patient_data.values()))
        print("Rows affected:", c.rowcount)
        conn.commit()
        conn.close()
        return jsonify({'message': 'Patient data saved successfully', 'patient_id': patient_id}), 201
    except sqlite3.Error as e:
        print("Database error:", str(e))
        return jsonify({'message': f'Error saving patient data: {str(e)}'}), 500

# Get patient data
@app.route('/patient-data', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_patient_data():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200

    patient_id = get_jwt_identity()
    conn = sqlite3.connect('hack.db')
    c = conn.cursor()
    c.execute("SELECT * FROM Patients WHERE patient_id = ?", (patient_id,))
    patient = c.fetchone()
    conn.close()

    if not patient:
        return jsonify({'message': 'Patient not found'}), 404

    patient_data = {
        'patient_id': patient[0],
        'firstName': patient[1],
        'lastName': patient[2],
        'gender': patient[3],
        'dob': patient[4],
        'phoneNumber': patient[5],
        'email': patient[6],
        'address': patient[7],
        'emergencyContact': patient[8],
        'emergencyPhone': patient[9],
        'height': patient[10],
        'preWeight': patient[11],
        'currentWeight': patient[12],
        'lmp': patient[13],
        'dueDate': patient[14],
        'gravida': patient[15],
        'para': patient[16],
        'bloodGroup': patient[17],
        'primaryProvider': patient[18],
        'preferredHospital': patient[19],
        'registration_date': patient[20],
        'last_updated': patient[21]
    }
    return jsonify(patient_data), 200

# Store medical report
@app.route('/store-report', methods=['POST', 'OPTIONS'])
@jwt_required()
def store_report():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200

    patient_id = get_jwt_identity()
    data = request.get_json()

    report_data = {
        'report_id': data.get('id'),
        'patient_id': patient_id,
        'type': data.get('type'),
        'category': data.get('category'),
        'date': data.get('date'),
        'file_url': data.get('fileUrl'),
        'notes': data.get('notes'),
        'analysis_results': json.dumps(data.get('analysisResults', {})),
        'created_at': datetime.datetime.now().isoformat()
    }

    if not all([report_data['report_id'], report_data['type'], report_data['category'], report_data['date'], report_data['file_url']]):
        return jsonify({'message': 'Missing required fields'}), 400

    try:
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute('''INSERT INTO MedicalReports 
                     (report_id, patient_id, type, category, date, file_url, notes, analysis_results, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  tuple(report_data.values()))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Report stored successfully', 'report_id': report_data['report_id']}), 201
    except sqlite3.Error as e:
        return jsonify({'message': f'Error storing report: {str(e)}'}), 500

# Get medical reports
@app.route('/medical-reports', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_medical_reports():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'OK'}), 200

    patient_id = get_jwt_identity()
    conn = sqlite3.connect('hack.db')
    c = conn.cursor()
    c.execute("SELECT * FROM MedicalReports WHERE patient_id = ?", (patient_id,))
    reports = c.fetchall()
    conn.close()

    if not reports:
        return jsonify([]), 200

    medical_reports = []
    for report in reports:
        medical_reports.append({
            'id': report[0],
            'patient_id': report[1],
            'type': report[2],
            'category': report[3],
            'date': report[4],
            'fileUrl': report[5],
            'notes': report[6],
            'analysisResults': json.loads(report[7]) if report[7] else None,
            'created_at': report[8]
        })

    return jsonify(medical_reports), 200


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
            f"http://localhost:8000/generate_report", 
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




if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=6000)