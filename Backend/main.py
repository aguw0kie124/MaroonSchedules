import postgre_test
from fastapi import Body, FastAPI
import requests
from requests import RequestException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import test_func
from chat import router as chat_router
import postgre_test

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Demo-friendly for Expo Go + web
    allow_credentials=False,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(chat_router)

@app.get("/")
def read_root():
    return {"message": "hi"}

@app.get("/test_func")
def test():
    return test_func.test_func()


@app.get("/test_postgre")
def test_postgre():
    return postgre_test.test_postgre_data()

import time
