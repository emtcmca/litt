from google.cloud import firestore
from app.config import GOOGLE_CLOUD_PROJECT

_client: firestore.Client | None = None


def get_db() -> firestore.Client:
    global _client
    if _client is None:
        _client = firestore.Client(project=GOOGLE_CLOUD_PROJECT)
    return _client


def firm_ref(firm_id: str) -> firestore.DocumentReference:
    return get_db().collection("firms").document(firm_id)


def collection_ref(firm_id: str, collection: str) -> firestore.CollectionReference:
    return firm_ref(firm_id).collection(collection)
