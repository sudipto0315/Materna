from flask import Flask, request, jsonify
import sqlite3
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn as nn
import pytorch_lightning as pl
from torchvision import transforms
from PIL import Image
import io
import datetime
import uuid
import json

# Model definitions (unchanged)
class BasicBlock(nn.Module):
    expansion = 1
    def __init__(self, inplanes, planes, stride=1, downsample=None):
        super().__init__()
        self.conv1 = nn.Conv2d(inplanes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        self.downsample = downsample
        self.stride = stride
    
    def forward(self, x):
        identity = x
        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        out = self.conv2(out)
        out = self.bn2(out)
        if self.downsample is not None:
            identity = self.downsample(x)
        out += identity
        return out

class ResNet(nn.Module):
    def __init__(self, block, layers, num_classes=4):
        super().__init__()
        self.inplanes = 64
        self.conv1 = nn.Conv2d(3, self.inplanes, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(self.inplanes)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        self.layer1 = self._make_layer(block, 64, layers[0])
        self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
        self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
        self.layer4 = self._make_layer(block, 512, layers[3], stride=2)
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512, num_classes)
    
    def _make_layer(self, block, planes, blocks, stride=1):
        downsample = None
        if stride != 1 or self.inplanes != planes:
            downsample = nn.Sequential(
                nn.Conv2d(self.inplanes, planes, 1, stride, bias=False), 
                nn.BatchNorm2d(planes)
            )
        layers = []
        layers.append(block(self.inplanes, planes, stride, downsample))
        self.inplanes = planes
        for _ in range(1, blocks):
            layers.append(block(self.inplanes, planes))
        return nn.Sequential(*layers)
    
    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)
        return x

def resnet34():
    return ResNet(BasicBlock, [3, 4, 6, 3])

def get_model():
    return resnet34()

class ImageClassifier(pl.LightningModule):
    def __init__(self, model, num_classes=4, lr=1e-3):
        super().__init__()
        self.save_hyperparameters(ignore=['model'])
        self.model = model
    
    def forward(self, x):
        return self.model(x)
    
app = Flask(__name__)
CORS(app)

# Initialize device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Running on {device}")

# Define class names
orientation_classes = ('hdvb', 'hdvf', 'huvb', 'huvf')
plane_classes = ('AC_PLANE', 'BPD_PLANE', 'NO_Plane', 'FL_PLANE')

# Load models
orientation_model_path = 'Orientation_RES34.pth'
plane_model_path = 'PLANE_34.pth'

try:
    orientation_classifier = torch.load(orientation_model_path, map_location=device, weights_only=False)
    orientation_classifier.to(device)
    orientation_classifier.eval()
except Exception as e:
    print(f"Error loading orientation model: {e}")
    raise

try:
    plane_model = get_model()
    plane_classifier = ImageClassifier(plane_model)
    state_dict = torch.load(plane_model_path, map_location=device, weights_only=False)
    plane_classifier.load_state_dict(state_dict)
    plane_classifier.to(device)
    plane_classifier.eval()
except Exception as e:
    print(f"Error loading plane model: {e}")
    raise

def preprocess_image(image_data):
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
    ])
    image = Image.open(io.BytesIO(image_data)).convert('RGB')
    image = transform(image)
    image = image.unsqueeze(0)
    return image

def predict(image, model, device, classes):
    image = image.to(device)
    with torch.no_grad():
        outputs = model(image)
        probabilities = torch.softmax(outputs, dim=1)[0]
        predicted_class_idx = torch.argmax(probabilities).item()
        predicted_class = classes[predicted_class_idx]
        confidence = probabilities[predicted_class_idx].item() * 100
    return predicted_class, confidence

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict_image():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'success'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response, 200

    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image selected'}), 400

        if not file.mimetype.startswith('image/'):
            return jsonify({'error': 'Invalid file type. Please upload an image.'}), 400

        image_data = file.read()
        image = preprocess_image(image_data)
        
        orientation_pred, orientation_conf = predict(
            image, orientation_classifier, device, orientation_classes
        )
        
        plane_pred, plane_conf = predict(
            image, plane_classifier, device, plane_classes
        )
        
        result = {
            'orientation': {
                'prediction': orientation_pred,
                'confidence': float(orientation_conf)
            },
            'plane': {
                'prediction': plane_pred,
                'confidence': float(plane_conf)
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=6000)