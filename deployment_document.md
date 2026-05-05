# Physics Sandbox — Deployment Document

> **Course:** SE202L — DevOps Lab  
> **Project:** Physics Sandbox  
> **Stack:** Flask · Docker · GitHub Actions · AWS EC2  

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Tools and Technologies](#3-tools-and-technologies)
4. [Local Setup Instructions](#4-local-setup-instructions)
5. [CI/CD Pipeline Explanation](#5-cicd-pipeline-explanation)
6. [Deployment Steps](#6-deployment-steps)
7. [Testing Evidence](#7-testing-evidence)
8. [Challenges and Solutions](#8-challenges-and-solutions)
9. [Lessons Learned](#9-lessons-learned)

---

## 1. Application Overview

**Physics Sandbox** is an interactive web application that lets students and hobbyists explore four classic physics experiments directly in the browser — no installation required. Each experiment has real-time canvas animations that update as you drag the parameter sliders, making abstract formulas tangible and visual.

### Who Uses It

- University students studying introductory physics or engineering
- Educators who want a live demo tool in the classroom
- Anyone curious about how changing gravity, angle, or spring constant affects motion

### What the App Does

| Experiment | Inputs | Outputs |
|---|---|---|
| Projectile Motion | Angle, initial velocity, gravity | Max height, range, time of flight |
| Pendulum | Rope length, start angle, gravity | Period, frequency |
| Free Fall | Drop height, gravity | Time to fall, final velocity |
| Spring / Hooke's Law | Spring constant (k), displacement (x) | Force (F = kx), potential energy |

Results can be saved to a backend store and reviewed in a live dashboard table at the bottom of the page.

### API Endpoints

All endpoints are served by the Flask backend. The frontend communicates with these same-origin endpoints using the browser `fetch` API.

| Method | URL | Description | Example Response |
|---|---|---|---|
| `GET` | `/` | Serves the main frontend HTML page | `200 OK` — `index.html` |
| `GET` | `/health` | Health check — confirms the server is running | `{"status": "ok"}` |
| `GET` | `/experiments` | Returns a JSON array of all saved experiment results | `[{"id": "abc-123", "experiment": "Pendulum", ...}]` |
| `POST` | `/experiments` | Saves a new experiment result (JSON body required) | `201 Created` — `{"id": "abc-123", "experiment": "...", "parameters": {...}, "result": {...}, "timestamp": "..."}` |
| `GET` | `/experiments/<id>` | Returns a single experiment record by its UUID | `{"id": "abc-123", "experiment": "Free Fall", ...}` |
| `DELETE` | `/experiments/<id>` | Permanently deletes an experiment record by UUID | `{"message": "Deleted successfully"}` |

**Error responses:**

| Situation | Status Code | Body |
|---|---|---|
| Missing JSON fields on POST | `400` | `{"error": "Missing required field: result"}` |
| Experiment ID not found | `404` | `{"error": "Experiment not found"}` |

---

## 2. Architecture Diagram

The diagram below shows the full path of a request from the user's browser all the way to the Flask app running inside Docker on an EC2 instance.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                             │
│                                                                     │
│   Opens http://<EC2-IP>:5000                                        │
│   Loads index.html, style.css, app.js  (GET /)                      │
│   Saves experiment results             (POST /experiments)          │
│   Fetches saved results                (GET  /experiments)          │
│   Deletes a record                     (DELETE /experiments/<id>)   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  HTTP requests over the internet
                            │  Port 5000 (open in Security Group)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AWS EC2 INSTANCE                                │
│                  (Ubuntu 22.04 LTS, t2.micro)                       │
│                                                                     │
│   Public IP: <EC2-PUBLIC-IP>                                        │
│   Inbound rules: port 22 (SSH), port 5000 (HTTP)                    │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │               DOCKER CONTAINER                              │   │
│   │           (physics-sandbox image)                           │   │
│   │                                                             │   │
│   │   ┌─────────────────────────────────────────────────────┐   │   │
│   │   │                 FLASK APP  (app.py)                  │   │   │
│   │   │                                                       │   │   │
│   │   │   • Serves frontend/index.html on GET /              │   │   │
│   │   │   • Handles REST API routes                          │   │   │
│   │   │   • Stores experiments in Python list (in-memory)    │   │   │
│   │   │   • flask-cors allows cross-origin requests          │   │   │
│   │   │   • Listens on 0.0.0.0:5000                          │   │   │
│   │   └─────────────────────────────────────────────────────┘   │   │
│   │                                                             │   │
│   │   Host port 5000  ←──────────►  Container port 5000        │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tools and Technologies

| Tool | Purpose |
|---|---|
| **Linux** (Ubuntu 22.04) | Operating system on the EC2 server that hosts the Docker container |
| **Python 3.11** | Runtime language for the Flask backend application |
| **Flask** | Lightweight Python web framework used to build the REST API and serve the frontend |
| **flask-cors** | Flask extension that adds CORS headers so the browser can call the API without being blocked |
| **Git** | Version control system used to track all code changes locally |
| **GitHub** | Remote repository hosting — stores the code and triggers the CI/CD pipeline on push |
| **Docker** | Containerization tool that packages the Flask app and its dependencies into a portable image |
| **GitHub Actions** | CI/CD platform that automatically runs tests and builds the Docker image on every push to `main` |
| **AWS EC2** | Cloud virtual machine (t2.micro, Ubuntu) where the Docker container runs in production |
| **pytest** | Python testing framework used to write and run the automated test suite for all API endpoints |
| **HTML / CSS / JavaScript** | Frontend technologies — a single-page app with canvas animations, glassmorphism UI, and fetch-based API calls |

---

## 4. Local Setup Instructions

These steps assume you already have **Git** and **Docker** installed on your machine. If you prefer running without Docker, you just need Python 3.11+.

### Option A — Run with Docker (recommended)

**1. Clone the repository**

```bash
git clone https://github.com/<your-username>/se202l-project.git
cd se202l-project
```

**2. Build the Docker image**

```bash
docker build -t physics-sandbox .
```

**3. Run the container**

```bash
docker run -d -p 5000:5000 --name sandbox physics-sandbox
```

**4. Open the app in your browser**

```
http://localhost:5000
```

**5. (Optional) Check the logs if something looks wrong**

```bash
docker logs sandbox
```

**6. Stop the container when done**

```bash
docker stop sandbox && docker rm sandbox
```

---

### Option B — Run directly with Python

**1. Clone the repository**

```bash
git clone https://github.com/<your-username>/se202l-project.git
cd se202l-project
```

**2. Create and activate a virtual environment**

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Start the Flask server**

```bash
python app.py
```

**5. Open the app in your browser**

```
http://localhost:5000
```

**6. Run the test suite**

```bash
python -m pytest test_app.py -v
```

---

## 5. CI/CD Pipeline Explanation

The CI/CD pipeline lives in `.github/workflows/ci.yml` and runs automatically on GitHub Actions. Here is a plain-English walkthrough of exactly what happens:

### What Triggers the Workflow

Whenever you push a commit to the `main` branch (or open a pull request targeting `main`), GitHub detects the event and immediately queues the pipeline. You do not have to manually start anything — it kicks off by itself.

### Job 1 — `test` (Run pytest)

This job spins up a fresh Ubuntu virtual machine on GitHub's servers and does the following:

1. **Checks out your code** — downloads a clean copy of the repository.
2. **Sets up Python 3.11** — installs the exact Python version we target.
3. **Installs dependencies** — runs `pip install -r requirements.txt` to get Flask, flask-cors, and pytest.
4. **Runs the test suite** — executes `pytest test_app.py -v --tb=short`.

If every test passes (all 17 currently do), the job is marked green and the next job is allowed to start.

### Job 2 — `build-docker` (Build image and verify health)

This job only starts **if the `test` job passed** (enforced by `needs: test` in the YAML). It:

1. **Checks out the code** again on a fresh machine.
2. **Builds the Docker image** using the `Dockerfile` — this proves the image can actually be built from scratch.
3. **Runs the container** — starts it in the background with `docker run -d`.
4. **Hits the `/health` endpoint** using `curl` and checks the HTTP status code is `200`. If it's anything else, the job fails and you get notified.
5. **Stops and removes the container** — cleanup, even if a previous step failed.

### What Happens if Tests Fail

If any test in Job 1 fails, Job 2 never runs — there is no point building and shipping a Docker image that contains broken code. GitHub marks the commit with a red ✗, sends you an email notification, and the broken code cannot be considered safe to deploy. You fix the code, push again, and the pipeline retries automatically.

---

## 6. Deployment Steps

These are the exact commands run on a fresh AWS EC2 instance to get the app live. The instance used was a **t2.micro** running **Ubuntu 22.04 LTS** with port 22 and port 5000 open in the Security Group.

### Step 1 — SSH into the EC2 instance

```bash
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

### Step 2 — Update the system package list

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 3 — Install Docker

```bash
sudo apt install -y docker.io
```

### Step 4 — Start Docker and enable it on boot

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### Step 5 — Add your user to the docker group (avoid needing sudo every time)

```bash
sudo usermod -aG docker ubuntu
newgrp docker
```

### Step 6 — Install Git

```bash
sudo apt install -y git
```

### Step 7 — Clone the repository

```bash
git clone https://github.com/<your-username>/se202l-project.git
cd se202l-project
```

### Step 8 — Build the Docker image

```bash
docker build -t physics-sandbox .
```

This reads the `Dockerfile`, installs Python dependencies inside the image, and copies the app code in. It takes about 1–2 minutes the first time.

### Step 9 — Run the container (with auto-restart)

```bash
docker run -d \
  --name sandbox \
  -p 5000:5000 \
  --restart=always \
  physics-sandbox
```

The `--restart=always` flag means if the EC2 instance reboots, Docker will automatically start the container again — no manual intervention needed.

### Step 10 — Verify the container is running

```bash
docker ps
```

Expected output:

```
CONTAINER ID   IMAGE              COMMAND           CREATED         STATUS         PORTS                    NAMES
a1b2c3d4e5f6   physics-sandbox    "python app.py"   5 seconds ago   Up 4 seconds   0.0.0.0:5000->5000/tcp   sandbox
```

### Step 11 — Test the health endpoint from the server itself

```bash
curl http://localhost:5000/health
```

Expected output:

```json
{"status": "ok"}
```

### Step 12 — Open the app in your browser

```
http://<EC2-PUBLIC-IP>:5000
```

The Physics Sandbox UI should load with all four experiment tabs visible.

---

### Updating the App After a Code Change

When you push new code and want to redeploy:

```bash
# On the EC2 instance
cd se202l-project
git pull origin main
docker build -t physics-sandbox .
docker stop sandbox && docker rm sandbox
docker run -d --name sandbox -p 5000:5000 --restart=always physics-sandbox
```

---

## 7. Testing Evidence

### Running the Test Suite

```bash
python -m pytest test_app.py -v --tb=short
```

**Passing output:**

```
============================= test session starts =============================
platform win32 -- Python 3.13.13, pytest-9.0.3, pluggy-1.6.0
rootdir: D:\...\se202l-project
collecting ... collected 17 items

test_app.py::TestHealth::test_health_returns_200 PASSED                  [  5%]
test_app.py::TestHealth::test_health_returns_ok_status PASSED            [ 11%]
test_app.py::TestGetExperiments::test_get_experiments_empty_list PASSED  [ 17%]
test_app.py::TestGetExperiments::test_get_experiments_after_insert PASSED [ 23%]
test_app.py::TestGetExperiments::test_get_experiments_returns_list PASSED [ 29%]
test_app.py::TestPostExperiment::test_post_returns_201 PASSED            [ 35%]
test_app.py::TestPostExperiment::test_post_returns_experiment_with_id PASSED [ 41%]
test_app.py::TestPostExperiment::test_post_missing_field_returns_400 PASSED [ 47%]
test_app.py::TestPostExperiment::test_post_no_body_returns_400 PASSED    [ 52%]
test_app.py::TestPostExperiment::test_post_increments_store PASSED       [ 58%]
test_app.py::TestGetExperimentById::test_get_by_id_returns_200 PASSED    [ 64%]
test_app.py::TestGetExperimentById::test_get_by_id_returns_correct_record PASSED [ 70%]
test_app.py::TestGetExperimentById::test_get_by_invalid_id_returns_404 PASSED [ 76%]
test_app.py::TestDeleteExperiment::test_delete_returns_200 PASSED        [ 82%]
test_app.py::TestDeleteExperiment::test_delete_removes_from_store PASSED [ 88%]
test_app.py::TestDeleteExperiment::test_delete_nonexistent_returns_404 PASSED [ 94%]
test_app.py::TestDeleteExperiment::test_deleted_record_no_longer_accessible PASSED [100%]

============================== 17 passed in 0.28s ==============================
```

---

### Live curl Tests Against the Running Server

#### Health Check

```bash
curl -s http://localhost:5000/health
```

**Expected response:**

```json
{"status": "ok"}
```

---

#### GET /experiments (empty store)

```bash
curl -s http://localhost:5000/experiments
```

**Expected response:**

```json
[]
```

---

#### POST /experiments (save a result)

```bash
curl -s -X POST http://localhost:5000/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "experiment": "Projectile Motion",
    "parameters": {"angle": "45.00", "velocity": "30.00", "gravity": "9.80"},
    "result": {"maxHeight": "11.48", "range": "91.84", "timeOfFlight": "4.33"}
  }'
```

**Expected response (HTTP 201):**

```json
{
  "experiment": "Projectile Motion",
  "id": "e3a7c91f-4b2d-4e88-a5f1-7c0d3f8b12ea",
  "parameters": {
    "angle": "45.00",
    "gravity": "9.80",
    "velocity": "30.00"
  },
  "result": {
    "maxHeight": "11.48",
    "range": "91.84",
    "timeOfFlight": "4.33"
  },
  "timestamp": "2026-05-05T18:42:07.123456+00:00"
}
```

---

#### GET /experiments/<id> (fetch by ID)

```bash
curl -s http://localhost:5000/experiments/e3a7c91f-4b2d-4e88-a5f1-7c0d3f8b12ea
```

**Expected response (HTTP 200):** *(same object as above)*

---

#### DELETE /experiments/<id>

```bash
curl -s -X DELETE http://localhost:5000/experiments/e3a7c91f-4b2d-4e88-a5f1-7c0d3f8b12ea
```

**Expected response (HTTP 200):**

```json
{"message": "Deleted successfully"}
```

---

#### POST with missing field (error case)

```bash
curl -s -X POST http://localhost:5000/experiments \
  -H "Content-Type: application/json" \
  -d '{"experiment": "Free Fall"}'
```

**Expected response (HTTP 400):**

```json
{"error": "Missing required field: parameters"}
```

---

## 8. Challenges and Solutions

### Challenge 1 — Docker Container Running but App Not Accessible from Browser

**What happened:**  
After deploying the Docker container on EC2 and confirming it was running with `docker ps`, opening `http://<EC2-IP>:5000` in the browser just hung and eventually timed out. The container was working fine — running `curl http://localhost:5000/health` from inside the EC2 terminal returned `{"status": "ok"}` instantly.

**Root cause:**  
When an EC2 instance is launched, AWS blocks all inbound traffic by default. The Security Group attached to the instance had rules only for port 22 (SSH). Port 5000 — the port our Flask app listens on — was not in the inbound rules, so AWS was silently dropping every request from the internet before it even reached the server.

**Solution:**  
Navigate to the EC2 console → Security Groups → select the group attached to the instance → Inbound Rules → Add Rule:

- **Type:** Custom TCP  
- **Port range:** 5000  
- **Source:** 0.0.0.0/0 (anywhere)

After saving, the browser immediately connected. The lesson: always check Security Groups first when a Docker container runs fine locally but is unreachable from outside.

---

### Challenge 2 — CORS Error When Frontend Tried to Call the API

**What happened:**  
During early development, the frontend HTML was opened directly from the filesystem (`file://`) while the Flask server ran on `http://localhost:5000`. Every `fetch()` call to the API failed in the browser console with an error like:

```
Access to fetch at 'http://localhost:5000/experiments' from origin 'null'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
is present on the requested resource.
```

The requests never even reached the Flask route — they were rejected by the browser before being sent.

**Root cause:**  
Browsers enforce the Same-Origin Policy: a page served from one origin (e.g. `file://` or `http://localhost:3000`) is not allowed to make requests to a different origin (`http://localhost:5000`) unless the server explicitly says it's OK by sending the `Access-Control-Allow-Origin` response header. Flask does not send this header by default.

**Solution:**  
Install and enable `flask-cors`:

```bash
pip install flask-cors
```

Then add two lines to `app.py`:

```python
from flask_cors import CORS

CORS(app)
```

This makes Flask include `Access-Control-Allow-Origin: *` in every response, telling the browser that any origin is allowed to call the API. The final production setup avoids this entirely because the frontend is served by the same Flask server (same origin), but `flask-cors` is kept in place as a safety net.

---

## 9. Lessons Learned

**1. Containers make deployment boring — and that is a good thing.**  
Before Docker, "it works on my machine" was a constant problem. After containerizing the Flask app, the exact same image that passed tests locally was the image that ran on EC2. There were zero surprises about missing dependencies or wrong Python versions. Boring deployment is the goal.

**2. Automate your tests before you write production code.**  
Setting up pytest and writing test cases for every endpoint early in the project meant that every change to `app.py` was immediately validated. When the `datetime.utcnow()` deprecation warning appeared, the test suite caught the output change right away. Tests are not extra work — they save time.

**3. CI/CD pipelines catch mistakes you would never find manually.**  
GitHub Actions ran 17 tests on every single push, including cases we never thought to test manually — like `POST` with an empty body, or `DELETE` on an already-deleted ID. The pipeline makes it impossible to accidentally ship broken code to `main`.

**4. Security groups are the first thing to check when networking breaks.**  
A huge amount of debugging time was spent before realizing that AWS Security Groups were blocking port 5000. Network issues in cloud environments almost always come down to firewall rules. Always verify: is the port open? Before checking code.

**5. Reading error messages carefully is a skill worth developing.**  
The CORS error message in the browser console said exactly what was wrong and what was missing (`No 'Access-Control-Allow-Origin' header`). The fix (two lines of code) took two minutes once the error was actually read instead of ignored. Error messages are documentation — they tell you what the system expected and what it got.

---

*Document prepared for SE202L DevOps Lab — Physics Sandbox project.*
