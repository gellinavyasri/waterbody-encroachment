from flask import Flask, render_template, request, redirect, url_for
import os
import numpy as np
from tensorflow.keras.models import load_model  # type: ignore
from utils.preprocess import normalize_kolleru, normalize_canal
from utils.visualize import save_prediction_map
from skimage.morphology import remove_small_objects
from scipy.ndimage import binary_opening, binary_closing
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

# ----------------------------------------------------------------------
# CLEAN PREDICTION FUNCTION
# ----------------------------------------------------------------------
def clean_prediction(prediction, min_water_size=50):
    cleaned = prediction.copy()
    water_mask = (prediction == 1)

    if water_mask.any():
        water_cleaned = remove_small_objects(water_mask, min_size=min_water_size)
        water_cleaned = binary_opening(water_cleaned, iterations=1)
        water_cleaned = binary_closing(water_cleaned, iterations=1)
        cleaned[water_mask] = 0
        cleaned[water_cleaned] = 1
    return cleaned

# ----------------------------------------------------------------------
# FLASK SETUP
# ----------------------------------------------------------------------
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['OUTPUT_FOLDER'] = 'static/outputs'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# ----------------------------------------------------------------------
# LOAD MODELS
# ----------------------------------------------------------------------
models = {
    "Kolleru Lake": {
        "model": load_model("models/kolleru_model.h5"),
        "norm": np.load("models/kolleru_norm.npz")
    },
    "College Canal": {
        "model": load_model("models/canal_model.h5"),
        "norm": np.load("models/canal_norm.npz", allow_pickle=True)
    }
}

# ----------------------------------------------------------------------
# ROUTES
# ----------------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')

# ----------------------------------------------------------------------
# SINGLE TIFF PREDICTION
# ----------------------------------------------------------------------
@app.route('/predict', methods=['POST'])
def predict():
    if 'tiff_file' not in request.files:
        return redirect(request.url)

    file = request.files['tiff_file']
    model_choice = request.form['model_choice']

    if file.filename == '':
        return redirect(request.url)

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)

    model_info = models[model_choice]
    model = model_info["model"]
    norm = model_info["norm"]

    # Select normalization
    if model_choice == "Kolleru Lake":
        data, transform = normalize_kolleru(filepath, norm)
    else:
        data, transform = normalize_canal(filepath, norm)

    # Predict
    print(f"🚀 Predicting {file.filename} using {model_choice} model...")
    num_bands, H, W = data.shape
    X = np.transpose(data, (1, 2, 0)).reshape(-1, num_bands)
    y_pred = model.predict(X, batch_size=4096, verbose=0).argmax(axis=1)
    pred_map = clean_prediction(y_pred.reshape(H, W))

    output_filename = f"{file.filename.split('.')[0]}_{model_choice.replace(' ', '_')}_result.png"
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
    save_prediction_map(pred_map, output_path)

    image_url = url_for('static', filename=f"outputs/{output_filename}")
    return render_template('result.html',
                           image_path=image_url,
                           model_used=model_choice,
                           filename=file.filename)

# ----------------------------------------------------------------------
# COMPARE TWO YEARS - TEMPORAL CHANGE DETECTION
# ----------------------------------------------------------------------
@app.route('/compare_years', methods=['POST'])
def compare_years():
    model_choice = request.form['model_choice']
    file1 = request.files['year1']
    file2 = request.files['year2']

    if file1.filename == '' or file2.filename == '':
        return redirect(request.url)

    # Save uploaded files
    path1 = os.path.join(app.config['UPLOAD_FOLDER'], file1.filename)
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], file2.filename)
    file1.save(path1)
    file2.save(path2)

    print(f"📂 Uploaded: {file1.filename}, {file2.filename}")

    model_info = models[model_choice]
    model = model_info["model"]
    norm = model_info["norm"]
    normalize_fn = normalize_kolleru if model_choice == "Kolleru Lake" else normalize_canal

    # ---------------- Predict both years ----------------
    data1, _ = normalize_fn(path1, norm)
    data2, _ = normalize_fn(path2, norm)
    num_bands, H, W = data1.shape

    def predict_year(data):
        X = np.transpose(data, (1, 2, 0)).reshape(-1, num_bands)
        y_pred = model.predict(X, batch_size=4096, verbose=0).argmax(axis=1)
        return clean_prediction(y_pred.reshape(H, W))

    pred1 = predict_year(data1)
    pred2 = predict_year(data2)

    # Save maps
    out1 = os.path.join(app.config['OUTPUT_FOLDER'], f"{file1.filename}_pred.png")
    out2 = os.path.join(app.config['OUTPUT_FOLDER'], f"{file2.filename}_pred.png")
    save_prediction_map(pred1, out1)
    save_prediction_map(pred2, out2)

    pixel_area_km2 = (10 * 10) / 1e6  # Sentinel-2 10m resolution

    # ---------------- Model-specific change logic ----------------
    if model_choice == "College Canal":
        print("\n🔍 Performing detailed change detection (2018→2024)...")
        water_to_builtup = (pred1 == 1) & (pred2 == 2)
        water_to_veg = (pred1 == 1) & (pred2 == 3)
        veg_to_builtup = (pred1 == 3) & (pred2 == 2)
        water_lost = (pred1 == 1) & (pred2 != 1)
        water_gained = (pred1 != 1) & (pred2 == 1)

        changes = {
            'Water → Built-up': np.sum(water_to_builtup) * pixel_area_km2,
            'Water → Vegetation': np.sum(water_to_veg) * pixel_area_km2,
            'Vegetation → Built-up': np.sum(veg_to_builtup) * pixel_area_km2,
            'Water Lost (Total)': np.sum(water_lost) * pixel_area_km2,
            'Water Gained (Total)': np.sum(water_gained) * pixel_area_km2
        }

        change_map = np.zeros_like(pred1, dtype=np.uint8)
        change_map[water_to_builtup] = 1
        change_map[water_to_veg] = 2
        change_map[veg_to_builtup] = 3
        change_colors = ['#FFFFFF', '#FF0000', '#FFFF00', '#FFA500']
        change_cmap = plt.matplotlib.colors.ListedColormap(change_colors)

        # Add legend
        legend_elements = [
            Patch(facecolor='#FF0000', label='Water → Built-up'),
            Patch(facecolor='#FFFF00', label='Water → Vegetation'),
            Patch(facecolor='#FFA500', label='Vegetation → Built-up')
        ]
    else:
        print("\n🔍 Performing simplified change detection...")
        water_to_builtup = (pred1 == 1) & (pred2 == 2)
        water_to_veg = (pred1 == 1) & (pred2 == 3)
        veg_to_builtup = (pred1 == 3) & (pred2 == 2)

        changes = {
            'Water → Built-up': np.sum(water_to_builtup) * pixel_area_km2,
            'Water → Vegetation': np.sum(water_to_veg) * pixel_area_km2,
            'Vegetation → Built-up': np.sum(veg_to_builtup) * pixel_area_km2
        }

        change_map = np.zeros_like(pred1, dtype=np.uint8)
        change_map[water_to_builtup] = 1
        change_map[water_to_veg] = 2
        change_map[veg_to_builtup] = 3
        change_cmap = plt.matplotlib.colors.ListedColormap(['white', 'red', 'yellow', 'orange'])

        legend_elements = [
            Patch(facecolor='red', label='Water → Built-up'),
            Patch(facecolor='yellow', label='Water → Vegetation'),
            Patch(facecolor='orange', label='Vegetation → Built-up')
        ]

    # Save change map
    change_path = os.path.join(app.config['OUTPUT_FOLDER'], "Change_Map.png")
    plt.figure(figsize=(10, 8))
    plt.imshow(change_map, cmap=change_cmap, vmin=0, vmax=3)
    plt.title(f"Change Map ({file1.filename} → {file2.filename})", fontweight='bold')
    plt.axis('off')
    plt.legend(handles=legend_elements, loc='lower right', fontsize=9, frameon=True)
    plt.savefig(change_path, bbox_inches='tight', pad_inches=0)
    plt.close()

    total_change = (change_map > 0).sum() / change_map.size * 100
    print(f"✅ Change detection complete — {total_change:.2f}% pixels changed")

    return render_template(
        'compare_years_result.html',
        year1_img=url_for('static', filename=f"outputs/{file1.filename}_pred.png"),
        year2_img=url_for('static', filename=f"outputs/{file2.filename}_pred.png"),
        change_img=url_for('static', filename="outputs/Change_Map.png"),
        change_percent=f"{total_change:.2f}%",
        model_used=model_choice,
        year1=file1.filename,
        year2=file2.filename,
        changes=changes
    )

@app.route('/analysis')
def analysis():
    return render_template('analysis.html')

# ----------------------------------------------------------------------
if __name__ == '__main__':
    app.run(debug=True)
