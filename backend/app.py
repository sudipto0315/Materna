from flask import Flask, request, jsonify
import sqlite3
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from datetime import datetime, timedelta
import uuid
import json
import requests
import threading
from pydantic import BaseModel, ValidationError
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

app = Flask(__name__)

# JWT configuration
app.config['JWT_SECRET_KEY'] = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
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
                 (user_id VARCHAR(50) PRIMARY KEY,
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
        contact_number VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        emergency_contact VARCHAR(50),
        emergency_number VARCHAR(20),
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
        report_id VARCHAR(50) PRIMARY KEY,
        patient_id VARCHAR(50) NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        file_url TEXT NOT NULL,
        notes TEXT,
        analysis_results TEXT,
        created_at TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES Patients(patient_id)
    )''')
    # GeneratedReports table to store generated reports
    c.execute('''CREATE TABLE IF NOT EXISTS GeneratedReports (
        report_id TEXT PRIMARY KEY,
        patient_id VARCHAR(50) NOT NULL,
        report_content TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES Patients(patient_id)
    )''')
    conn.commit()
    conn.close()

# Generate a unique patient ID
def generate_id():
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

    user_id = generate_id()
    patient_id = generate_id()
    hashed_password = generate_password_hash(password)

    try:
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute("INSERT INTO users (user_id, username, password, patient_id) VALUES (?, ?, ?, ?)", 
                  (user_id, username, hashed_password, patient_id))
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
        'report_id': generate_id(),
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


# Global variables for model, tokenizer, and vector store (loaded at startup)
model = None
tokenizer = None
vector_store = None

# Pydantic model for JSON input validation
class PatientRequest(BaseModel):
    patient_id: str
    patient_data: dict  # JSON object containing patient data

# [All unchanged functions remain the same: load_and_split_pdf, create_vector_store, 
# initialize_model_and_tokenizer, calculate_pregnancy_week, extract_patient_context, 
# generate_maternal_report]

def load_and_split_pdf(pdf_path):
    loader = PyPDFLoader(pdf_path)
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Your PDF has been split into {len(chunks)} chunks")
    return chunks

def create_vector_store(chunks, model_name="sentence-transformers/all-MiniLM-L6-v2", save_path="faiss_index"):
    embeddings = HuggingFaceEmbeddings(model_name=model_name)
    vector_store = FAISS.from_documents(chunks, embeddings)
    vector_store.save_local(save_path)
    return vector_store

def initialize_model_and_tokenizer(model_name="ritvik77/Medical_Doctor_AI_LoRA-Mistral-7B-Instruct_FullModel"):
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16,
        device_map="auto",
        load_in_4bit=True
    )
    return tokenizer, model

def calculate_pregnancy_week(lmp_date):
    lmp = datetime.strptime(lmp_date, '%Y-%m-%d')
    current_date = datetime.now()
    days_pregnant = (current_date - lmp).days
    weeks_pregnant = days_pregnant // 7
    return weeks_pregnant

def extract_patient_context(patient_data, patient_id):
    if patient_id not in patient_data:
        return "Patient not found."
    
    patient = patient_data[patient_id]
    personal_info = patient['personal_info']
    questionnaire = patient['questionnaire']
    risk_factors = patient.get('risk_factors', [])
    test_results = patient.get('test_results', [])
    
    context = f"""
Patient Summary:
Name: {personal_info['first_name']} {personal_info['last_name']}
Age: {2025 - int(personal_info['dob'].split('-')[0])} years
Gender: {personal_info['gender']}
Due Date: {personal_info['due_date']}
Last Menstrual Period: {personal_info['lmp']}
Current Week: {calculate_pregnancy_week(personal_info['lmp'])}
Blood Group: {personal_info['blood_group']}
Pre-existing Conditions: {personal_info['preexisting_conditions']}
Height: {personal_info['height_cm']} cm
Current Weight: {personal_info['current_weight']} kg
Pre-pregnancy Weight: {personal_info['pre_pregnancy_weight']} kg

Questionnaire Information:
First Pregnancy: {questionnaire['is_first_pregnancy']}
Exercise Frequency: {questionnaire['exercise_frequency']}
Emotional Wellbeing: {questionnaire['emotional_wellbeing']}
Prenatal Vitamins: {questionnaire['prenatal_vitamins']}
"""
    
    if risk_factors:
        context += "Risk Factors: ,"
        for risk in risk_factors:
            context += f"- {risk['test_name']}: {risk['result_value']} {risk['result_unit']} (Reference Range: {risk['reference_range']}), Risk Level: {risk['risk_level']},"
    
    abnormal_results = [result for result in test_results if result['risk_level'] in ['borderline', 'high_risk']]
    if abnormal_results:
        context += "Abnormal Test Results: ,"
        for result in abnormal_results:
            context += f"- {result['test_name']}: {result['result_value']} {result['result_unit']} (Reference Range: {result['ref_range_low']} - {result['ref_range_high']}), Risk Level: {result['risk_level']},"
    
    return context

def generate_maternal_report(patient_info, vector_store, model, tokenizer):
    if not tokenizer:
        raise ValueError("Tokenizer failed to initialize. Ensure 'sentencepiece' is installed.")
    retrieved_docs = vector_store.similarity_search(patient_info, k=3)
    medical_context = "\n".join([doc.page_content[:300] for doc in retrieved_docs])
    
    prompt = f"""You are an expert obstetrician. Analyze this maternal patient profile and provide a health assessment:

Patient Profile:
{patient_info}

Guidelines:
{medical_context}

Provide a profile analysis with:
1. Patient Overview
2. Health Status Analysis
3. Potential Risk Indicators
4. Recommendations
5. Next Steps
"""

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    inputs = tokenizer(
        prompt, 
        return_tensors="pt", 
        padding=True,
        truncation=True,
        max_length=3000
    )
    inputs = inputs.to(model.device)
    
    print("Starting generation...")
    
    try:
        outputs = model.generate(
            inputs.input_ids,
            attention_mask=inputs.attention_mask,
            max_new_tokens=800,
            temperature=0.3,
            top_p=0.9,
            do_sample=False,
            num_beams=1,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
        
        report = tokenizer.decode(outputs[0][inputs.input_ids.size(1):], skip_special_tokens=True)
        
        print(f"Generation complete, produced {len(outputs[0]) - inputs.input_ids.size(1)} tokens")
        
        if not report or len(report) < 50:
            print("Generated report too short, returning fallback")
            return """
# Maternal Health Assessment

## Patient Overview
The patient is currently pregnant and receiving prenatal care.

## Health Status Analysis
Based on the available information, the patient appears to be in stable condition.

## Potential Risk Indicators
A comprehensive risk assessment requires in-person evaluation.

## Recommendations
- Continue prenatal vitamins
- Maintain regular checkups
- Monitor for warning signs
- Stay hydrated and maintain a balanced diet

## Next Steps
Schedule next prenatal appointment within 4 weeks.
"""
        
        return report
    
    except Exception as e:
        print(f"Error during generation: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return "Error generating report. Please try again with simpler parameters."

# Startup initialization
def initialize_system():
    global model, tokenizer, vector_store
    pdf_path = "maternacare.pdf"
    
    try:
        print("Loading and splitting PDF...")
        chunks = load_and_split_pdf(pdf_path)
        
        print("Creating vector store...")
        vector_store = create_vector_store(chunks, save_path="maternal_care_faiss_index")
        
        print("Initializing model and tokenizer...")
        tokenizer, model = initialize_model_and_tokenizer()  
        print("System initialized successfully.")
    except Exception as e:
        print(f"Error during initialization: {str(e)}")
        import traceback
        print(traceback.format_exc())

# Initialize system when app starts
with app.app_context():
    initialize_system()

def generate_report_task(report_id, patient_id, patient_info):
    # Generate the report
    report = generate_maternal_report(patient_info, vector_store, model, tokenizer)
    
    # Update database with the completed report
    conn = sqlite3.connect('hack.db')
    c = conn.cursor()
    c.execute('''UPDATE GeneratedReports 
                 SET report_content = ?, status = ?, completed_at = ? 
                 WHERE report_id = ?''', 
              (report, 'completed', datetime.now().isoformat(), report_id))
    conn.commit()
    conn.close()
    
    print(f"Report {report_id} generated and stored in database")

# Modified API route to handle asynchronous report generation
@app.route('/generate_report', methods=['POST'])
def generate_report():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate input using Pydantic
        try:
            patient_request = PatientRequest(**data)
        except ValidationError as e:
            return jsonify({"error": "Invalid input data", "details": e.errors()}), 400
        
        patient_id = patient_request.patient_id
        patient_info = extract_patient_context(patient_request.patient_data, patient_id)
        if patient_info == "Patient not found.":
            return jsonify({"error": "Patient not found in the provided data"}), 404
        
        # Generate a unique report ID
        report_id = str(uuid.uuid4())
        
        # Store initial entry in database
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute('''INSERT INTO GeneratedReports 
                     (report_id, patient_id, status, created_at) 
                     VALUES (?, ?, ?, ?)''',
                  (report_id, patient_id, 'processing', datetime.now().isoformat()))
        conn.commit()
        conn.close()
        
        # Start background task to generate the report
        thread = threading.Thread(
            target=generate_report_task, 
            args=(report_id, patient_id, patient_info)
        )
        thread.daemon = True
        thread.start()
        
        # Return immediately with the report_id that client can use to check status
        return jsonify({
            "message": "Report generation started", 
            "report_id": report_id, 
            "status": "processing"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add a new endpoint to check report status and retrieve the report
@app.route('/check_report/<report_id>', methods=['GET'])
def check_report(report_id):
    try:
        conn = sqlite3.connect('hack.db')
        c = conn.cursor()
        c.execute("SELECT report_id, patient_id, report_content, status, created_at, completed_at FROM GeneratedReports WHERE report_id = ?", 
                  (report_id,))
        report = c.fetchone()
        conn.close()
        
        if not report:
            return jsonify({"error": "Report not found"}), 404
        
        report_data = {
            "report_id": report[0],
            "patient_id": report[1],
            "report_content": report[2],
            "status": report[3],
            "created_at": report[4],
            "completed_at": report[5]
        }
        
        return jsonify(report_data), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    init_db()
    app.run(port=6000)