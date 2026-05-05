"""
Pytest test suite for the Physics Sandbox Flask API.
Covers: health, GET /experiments, POST /experiments,
        GET /experiments/<id>, DELETE /experiments/<id>
"""
import pytest
import json
import app as flask_app_module


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_experiments():
    """Ensure a clean in-memory store before every test."""
    flask_app_module.experiments.clear()
    yield
    flask_app_module.experiments.clear()


@pytest.fixture
def client():
    flask_app_module.app.config["TESTING"] = True
    with flask_app_module.app.test_client() as c:
        yield c


SAMPLE_PAYLOAD = {
    "experiment": "Projectile Motion",
    "parameters": {"angle": 45, "velocity": 20, "gravity": 9.8},
    "result": {"maxHeight": 10.2, "range": 40.8, "timeOfFlight": 2.89},
}


# ─── Health Endpoint ──────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self, client):
        res = client.get("/health")
        assert res.status_code == 200

    def test_health_returns_ok_status(self, client):
        data = res = client.get("/health").get_json()
        assert data == {"status": "ok"}


# ─── GET /experiments ─────────────────────────────────────────────────────────

class TestGetExperiments:
    def test_get_experiments_empty_list(self, client):
        res = client.get("/experiments")
        assert res.status_code == 200
        assert res.get_json() == []

    def test_get_experiments_after_insert(self, client):
        client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        res = client.get("/experiments")
        assert res.status_code == 200
        assert len(res.get_json()) == 1

    def test_get_experiments_returns_list(self, client):
        res = client.get("/experiments")
        assert isinstance(res.get_json(), list)


# ─── POST /experiments ────────────────────────────────────────────────────────

class TestPostExperiment:
    def test_post_returns_201(self, client):
        res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        assert res.status_code == 201

    def test_post_returns_experiment_with_id(self, client):
        res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        data = res.get_json()
        assert "id" in data
        assert "timestamp" in data
        assert data["experiment"] == SAMPLE_PAYLOAD["experiment"]

    def test_post_missing_field_returns_400(self, client):
        bad_payload = {"experiment": "Free Fall"}  # missing parameters & result
        res = client.post(
            "/experiments",
            data=json.dumps(bad_payload),
            content_type="application/json",
        )
        assert res.status_code == 400

    def test_post_no_body_returns_400(self, client):
        res = client.post("/experiments", content_type="application/json")
        assert res.status_code == 400

    def test_post_increments_store(self, client):
        for _ in range(3):
            client.post(
                "/experiments",
                data=json.dumps(SAMPLE_PAYLOAD),
                content_type="application/json",
            )
        assert len(flask_app_module.experiments) == 3


# ─── GET /experiments/<id> ────────────────────────────────────────────────────

class TestGetExperimentById:
    def test_get_by_id_returns_200(self, client):
        post_res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        exp_id = post_res.get_json()["id"]
        res = client.get(f"/experiments/{exp_id}")
        assert res.status_code == 200

    def test_get_by_id_returns_correct_record(self, client):
        post_res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        exp_id = post_res.get_json()["id"]
        data = client.get(f"/experiments/{exp_id}").get_json()
        assert data["id"] == exp_id
        assert data["experiment"] == SAMPLE_PAYLOAD["experiment"]

    def test_get_by_invalid_id_returns_404(self, client):
        res = client.get("/experiments/nonexistent-id")
        assert res.status_code == 404


# ─── DELETE /experiments/<id> ─────────────────────────────────────────────────

class TestDeleteExperiment:
    def test_delete_returns_200(self, client):
        post_res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        exp_id = post_res.get_json()["id"]
        res = client.delete(f"/experiments/{exp_id}")
        assert res.status_code == 200

    def test_delete_removes_from_store(self, client):
        post_res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        exp_id = post_res.get_json()["id"]
        client.delete(f"/experiments/{exp_id}")
        assert len(flask_app_module.experiments) == 0

    def test_delete_nonexistent_returns_404(self, client):
        res = client.delete("/experiments/nonexistent-id")
        assert res.status_code == 404

    def test_deleted_record_no_longer_accessible(self, client):
        post_res = client.post(
            "/experiments",
            data=json.dumps(SAMPLE_PAYLOAD),
            content_type="application/json",
        )
        exp_id = post_res.get_json()["id"]
        client.delete(f"/experiments/{exp_id}")
        res = client.get(f"/experiments/{exp_id}")
        assert res.status_code == 404
