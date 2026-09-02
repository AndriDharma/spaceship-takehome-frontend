#!/usr/bin/env bash
#
# Build and deploy the frontend to Cloud Run.
#
# Configuration is loaded automatically from .env in the same directory as
# this script.
#
# Differs from the backend's deploy.sh in three ways:
#
#   1. It builds through cloudbuild.yaml rather than `--tag`, because Vite
#      inlines the backend URL at build time and `--tag` cannot pass a
#      --build-arg.
#   2. It asks for far less machine. The container is nginx serving static
#      files - it does no work per request.
#   3. It has no database, no Vertex AI, and therefore no runtime secrets.
#      Nothing here is sensitive; the bundle is public by definition.
#

set -euo pipefail

# ------------------------------------------------------------
# Load .env
# ------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Environment file not found:"
  echo "  ${ENV_FILE}"
  exit 1
fi

echo "Loading environment variables from ${ENV_FILE}..."

set -a

# shellcheck disable=SC1090
. "$ENV_FILE"

set +a

# ------------------------------------------------------------
# Defaults
# ------------------------------------------------------------

REGION="${REGION:-asia-southeast2}"

# Scaling to zero is fine here in a way it is not for the backend. An nginx
# container with a static bundle cold-starts in about a second, where the
# backend has to import LangGraph and the Vertex client before it can answer.
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-5}"

# Half a CPU and 256Mi. The container serves files off disk and computes
# nothing, so this is generous rather than tight.
#
# Fractional CPU requires the default request-based CPU allocation, which is
# what this script uses - do not add --no-cpu-throttling without also raising
# CPU back to 1.
CPU="${CPU:-0.5}"
MEMORY="${MEMORY:-256Mi}"

# nginx handles far more than Cloud Run's default 80 concurrent requests per
# instance, and raising it means fewer instances for the same traffic.
CONCURRENCY="${CONCURRENCY:-200}"

# ------------------------------------------------------------
# Validate required variables
# ------------------------------------------------------------

: "${PROJECT_ID:?PROJECT_ID is missing from .env}"
: "${REPOSITORY:?REPOSITORY is missing from .env}"
: "${IMAGE_NAME:?IMAGE_NAME is missing from .env}"
: "${SERVICE_NAME:?SERVICE_NAME is missing from .env}"
: "${SERVICE_ACCOUNT:?SERVICE_ACCOUNT is missing from .env}"

# Deliberately NOT named VITE_API_BASE.
#
# VITE_API_BASE is left empty in .env for local development, where the Vite
# dev server proxies /api to localhost:8080. If this script read that variable
# it would build a bundle with no backend URL, and every request from the
# deployed site would 404 against its own origin - a failure that looks like a
# broken backend rather than a broken build.
: "${BACKEND_URL:?BACKEND_URL is missing from .env - set it to the deployed backend's Cloud Run URL}"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest"
SERVICE_ACCOUNT_PATH="projects/${PROJECT_ID}/serviceAccounts/${SERVICE_ACCOUNT}"

echo
echo "Deployment configuration:"
echo "  Project:            ${PROJECT_ID}"
echo "  Region:             ${REGION}"
echo "  Repository:         ${REPOSITORY}"
echo "  Image:              ${IMAGE}"
echo "  Cloud Run service:  ${SERVICE_NAME}"
echo "  Service account:    ${SERVICE_ACCOUNT}"
echo "  Backend URL:        ${BACKEND_URL}"
echo "  CPU / memory:       ${CPU} / ${MEMORY}"
echo "  Concurrency:        ${CONCURRENCY}"
echo "  Min instances:      ${MIN_INSTANCES}"
echo "  Max instances:      ${MAX_INSTANCES}"
echo

gcloud config set project "$PROJECT_ID"

# ------------------------------------------------------------
# Build
# ------------------------------------------------------------
#
# BACKEND_URL becomes VITE_API_BASE inside the image, where Vite writes it into
# the bundle. Changing the backend URL therefore requires a rebuild, not just a
# redeploy.

echo "Building ${IMAGE}..."

gcloud builds submit \
  --region "$REGION" \
  --config "${SCRIPT_DIR}/cloudbuild.yaml" \
  --substitutions "_IMAGE=${IMAGE},_VITE_API_BASE=${BACKEND_URL}" \
  --service-account "$SERVICE_ACCOUNT_PATH" \
  --default-buckets-behavior "REGIONAL_USER_OWNED_BUCKET"

# ------------------------------------------------------------
# Deploy
# ------------------------------------------------------------
#
# No --set-env-vars. Everything the frontend needs was compiled into the
# bundle at build time; the running container only serves files.

echo "Deploying ${SERVICE_NAME}..."

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --service-account "$SERVICE_ACCOUNT" \
  --port 8080 \
  --allow-unauthenticated \
  --memory "$MEMORY" \
  --cpu "$CPU" \
  --concurrency "$CONCURRENCY" \
  --timeout 60 \
  --min-instances "$MIN_INSTANCES" \
  --max-instances "$MAX_INSTANCES"

SERVICE_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format="value(status.url)"
)"

# ------------------------------------------------------------
# Let the backend accept requests from this origin
# ------------------------------------------------------------
#
# The two services are deployed independently, so the backend cannot know this
# URL in advance. Without it in CORS_ORIGINS the browser blocks every call and
# the site loads but does nothing - a confusing failure, so it is worth
# closing here rather than leaving as a step to remember.
#
# Set BACKEND_SERVICE_NAME in .env to have this happen automatically.

if [ -n "${BACKEND_SERVICE_NAME:-}" ]; then
  echo
  echo "Allowing ${SERVICE_URL} as a CORS origin on ${BACKEND_SERVICE_NAME}..."

  gcloud run services update "$BACKEND_SERVICE_NAME" \
    --region "$REGION" \
    --update-env-vars "CORS_ORIGINS=${SERVICE_URL}"
else
  echo
  echo "NOTE: BACKEND_SERVICE_NAME is not set, so the backend's CORS_ORIGINS was"
  echo "      not updated. The site will load but every request will be blocked"
  echo "      by the browser until you run:"
  echo
  echo "  gcloud run services update YOUR_BACKEND_SERVICE \\"
  echo "    --region ${REGION} \\"
  echo "    --update-env-vars CORS_ORIGINS=${SERVICE_URL}"
fi

echo
echo "Frontend deployed to: ${SERVICE_URL}"
echo
echo "Open it and confirm the dashboard KPIs load. If the page renders but"
echo "stays empty, check the browser console - a CORS error means the step"
echo "above has not taken effect."
