from fastapi import APIRouter, HTTPException, Query

from services import annex_service


router = APIRouter(prefix="/annex", tags=["Annex"])


@router.get("/libraries")
def get_libraries():
    return annex_service.get_libraries()


@router.get("/libraries/{library_id}")
def get_library_detail(library_id: str, email: str | None = Query(None)):
    try:
        return annex_service.get_library_detail(library_id, email=email)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/rentals")
def get_rentals():
    return annex_service.get_rentals_overview()


@router.get("/rentals/{rental_id}")
def get_rental_detail(rental_id: str, email: str | None = Query(None)):
    try:
        return annex_service.get_rental_detail(rental_id, email=email)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
