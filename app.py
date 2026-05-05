import os
import uuid
from datetime import datetime, timezone
from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS

app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)

# In-memory store for experiments
experiments = []


# ─── Helper ───────────────────────────────────────────────────────────────────

def find_experiment(exp_id):
    return next((e for e in experiments if e["id"] == exp_id), None)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/experiments", methods=["GET"])
def get_experiments():
    return jsonify(experiments), 200


@app.route("/experiments", methods=["POST"])
def create_experiment():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    required_fields = ["experiment", "parameters", "result"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    record = {
        "id": str(uuid.uuid4()),
        "experiment": data["experiment"],
        "parameters": data["parameters"],
        "result": data["result"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    experiments.append(record)
    return jsonify(record), 201


@app.route("/experiments/<exp_id>", methods=["GET"])
def get_experiment(exp_id):
    exp = find_experiment(exp_id)
    if exp is None:
        return jsonify({"error": "Experiment not found"}), 404
    return jsonify(exp), 200


@app.route("/experiments/<exp_id>", methods=["DELETE"])
def delete_experiment(exp_id):
    exp = find_experiment(exp_id)
    if exp is None:
        return jsonify({"error": "Experiment not found"}), 404
    experiments.remove(exp)
    return jsonify({"message": "Deleted successfully"}), 200


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
