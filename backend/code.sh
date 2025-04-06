#!/bin/bash
wget -O kaggle.pem "https://snehanshu-bucket-boto.s3.ap-south-1.amazonaws.com/kaggle.pem"
chmod 600 kaggle.pem
echo "Installing required Python venv package..."
sudo apt update
sudo apt install -y python3.10-venv openssh-client
echo "Python venv package installed"
git clone https://github.com/sudipto0315/Materna
echo "Setting up Python virtual environment..."
python3 -m venv venv
sleep 5
echo "Virtual environment created successfully"
echo "Activating virtual environment..."
source venv/bin/activate
echo "Virtual environment activated"
cd Materna
cd backend
pip install gdown
gdown --id 1Nwo7x22zrjDfmuG2xp8_Ei9SyL7nyGpv
gdown --id 1wzCmSZFd9G875i8f0Ct3MdCjAFx0PWsF
echo "Downloading pth files done..."
echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt
echo "Dependencies installed successfully"
EC2_USER="ubuntu"
EC2_PUBLIC_IP="65.0.20.143"
touch backend.log
nohup python app.py > backend.log 2>&1 &
echo "FastAPI server started. Logs are in Materna/backend/backend.log"
sleep 5
