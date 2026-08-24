import os
import glob
import joblib
import json
import numpy as np

def export_sample_motion():
    files = glob.glob('sample_data/robot_filtered/**/*.pkl', recursive=True)
    if not files:
        print("No sample motion files found.")
        return

    data = joblib.load(files[0])
    key = list(data.keys())[0]
    motion = data[key]

    dof = motion['dof'].tolist() # Shape (N, 29)
    root_trans = motion['root_trans_offset'].tolist() # Shape (N, 3)
    root_rot = motion['root_rot'].tolist() # Shape (N, 4)
    fps = motion.get('fps', 30)

    out = {
        'fps': fps,
        'frames': len(dof),
        'dof': dof,
        'root_trans': root_trans,
        'root_rot': root_rot
    }

    os.makedirs('webgame/assets', exist_ok=True)
    with open('webgame/assets/sample_motion.json', 'w') as f:
        json.dump(out, f)
    print(f"Exported {len(dof)} frames of motion data to webgame/assets/sample_motion.json")

if __name__ == "__main__":
    export_sample_motion()
