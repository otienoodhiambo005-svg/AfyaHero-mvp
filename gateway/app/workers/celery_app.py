from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery = Celery(
    "afyahero_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.ai_worker",
        "app.workers.alert_worker",
        "app.workers.billing_worker",
        "app.workers.population_worker"
    ]
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Nairobi",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000
)

@celery.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Patient safety monitoring - every 5 minutes
    sender.add_periodic_task(
        300.0,
        "app.workers.alert_worker.monitor_deterioration",
        name="patient-deterioration-monitor"
    )

    # SHA claim follow-up - daily at 6am
    sender.add_periodic_task(
        crontab(hour=6, minute=0),
        "app.workers.billing_worker.followup_pending_claims",
        name="sha-claim-followup"
    )

    # Outbreak detection - nightly at 2am
    sender.add_periodic_task(
        crontab(hour=2, minute=0),
        "app.workers.population_worker.run_outbreak_detection",
        name="outbreak-detection"
    )

if __name__ == "__main__":
    celery.start()