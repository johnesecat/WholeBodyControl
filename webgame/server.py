#!/usr/bin/env python3
"""
MotionBricks Web Game Backend Server
Serves the web application and provides API endpoints for live MotionBricks motion streaming.
"""

from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import os
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, static_folder=ROOT_DIR)
CORS(app)

MOTION_DATA = None

def load_motion():
    global MOTION_DATA
    motion_path = os.path.join(ROOT_DIR, "webgame", "assets", "sample_motion.json")
    if os.path.exists(motion_path):
        with open(motion_path, "r") as f:
            MOTION_DATA = json.load(f)
        print("Loaded MotionBricks sample dataset into memory.")

@app.route("/")
def index():
    return send_from_directory(ROOT_DIR, "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(ROOT_DIR, path)

@app.route("/api/motion", methods=["GET"])
def get_motion():
    if not MOTION_DATA:
        load_motion()
    return jsonify(MOTION_DATA)

if __name__ == "__main__":
    load_motion()
    print("Starting MotionBricks Web Game Server at http://0.0.0.0:8080")
    app.run(host="0.0.0.0", port=8080, debug=False)
