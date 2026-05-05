### Health Check Endpoint

This project includes a simple health check endpoint to verify that the application is running.

**Endpoint:** `/health`
**Method:** `GET`

**Response:**

```json
{
  "status": "ok"
}
```

**Purpose:**

* Used by CI/CD pipelines to verify successful builds
* Confirms deployment on Amazon EC2
* Allows monitoring tools to check if the app is running

A `200 OK` response indicates the service is healthy and ready to handle requests.
