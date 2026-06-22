import os
import time
import requests
import jwt
import datetime
from dotenv import load_dotenv

# Load your secret to mint a valid testing token
load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    print("❌ ERROR: JWT_SECRET not found in .env file.")
    exit(1)

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    print("🚀 Starting End-to-End API Test...\n")

    # ==========================================
    # 1. MINT A MOCK SESSION TOKEN
    # ==========================================
    print("🔑 Step 1: Minting Auth Token...")
    token_payload = {
        "sub": "script_tester_001",
        "email": "tester@synthetic-agent.local",
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    }
    
    # Generate the token just like your /auth/google endpoint does
    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
    headers = {"Authorization": f"Bearer {access_token}"}
    print("✅ Token minted successfully.\n")

    # ==========================================
    # 2. TEST DATA GENERATION (/data/generate)
    # ==========================================
    print("⚙️ Step 2: Hitting /data/generate...")
    generate_payload = {
        "columns": [
            {"col_name": "id", "datatype": "integer", "desc": "Sequential ID"},
            {"col_name": "name", "datatype": "string", "desc": "Random full name"},
            {"col_name": "score", "datatype": "integer", "desc": "Random score between 1 and 100"}
        ],
        "overall_context": "Generate a simple user score table.",
        "num_rows": 50
    }

    start_time = time.time()
    res_gen = requests.post(f"{BASE_URL}/data/generate", json=generate_payload, headers=headers)
    
    if res_gen.status_code != 200:
        print(f"❌ Generation Failed ({res_gen.status_code}): {res_gen.text}")
        return
        
    gen_data = res_gen.json()
    filename = gen_data.get("filename")
    print(f"✅ Generation successful in {round(time.time() - start_time, 2)}s!")
    print(f"📄 Assigned Filename: {filename}\n")

    # ==========================================
    # 3. TEST CSV DOWNLOAD (/data/download)
    # ==========================================
    print(f"📥 Step 3: Downloading raw CSV...")
    res_csv = requests.get(f"{BASE_URL}/data/download/{filename}", headers=headers)
    
    if res_csv.status_code == 200:
        # Save it to a test folder or root just to verify it downloads
        with open("test_download.csv", "wb") as f:
            f.write(res_csv.content)
        print("✅ CSV downloaded and saved as 'test_download.csv'.\n")
    else:
        print(f"❌ CSV Download Failed: {res_csv.text}\n")

    # ==========================================
    # 4. TEST EXCEL CONVERSION (/data/download)
    # ==========================================
    excel_filename = filename.replace(".csv", ".xlsx")
    print(f"📊 Step 4: Testing on-the-fly Excel conversion for {excel_filename}...")
    res_excel = requests.get(f"{BASE_URL}/data/download/{excel_filename}", headers=headers)
    
    if res_excel.status_code == 200:
        with open("test_download.xlsx", "wb") as f:
            f.write(res_excel.content)
        print("✅ Excel file generated, downloaded, and saved as 'test_download.xlsx'.\n")
    else:
        print(f"❌ Excel Download Failed: {res_excel.text}\n")

    # ==========================================
    # 5. TEST HISTORY LOG (/data/history)
    # ==========================================
    print("🕰️ Step 5: Fetching User History...")
    res_history = requests.get(f"{BASE_URL}/data/history", headers=headers)
    
    if res_history.status_code == 200:
        history_data = res_history.json().get("history", [])
        print(f"✅ History retrieved! Found {len(history_data)} records for this user.")
        if history_data:
            print(f"   Latest record: {history_data[0]['filename']} ({history_data[0]['rows']} rows)")
    else:
        print(f"❌ History Fetch Failed: {res_history.text}")

    print("\n🎉 END-TO-END TEST COMPLETE!")

if __name__ == "__main__":
    run_test()