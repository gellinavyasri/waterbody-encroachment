import numpy as np
import rasterio

# ===============================================================
# COMMON UTILITIES
# ===============================================================
def clean_nan(data):
    """Replace NaN values with band medians."""
    for i in range(data.shape[0]):
        band = data[i]
        if np.isnan(band).any():
            median_val = np.nanmedian(band)
            data[i] = np.where(np.isnan(band), median_val, band)
    return data.astype(np.float32)

# ===============================================================
# KOLLERU NORMALIZATION (Z-score using mean/std)
# ===============================================================
def normalize_kolleru(tif_path, norm_params):
    """Applies the same mean/std normalization as used during model training."""
    with rasterio.open(tif_path) as src:
        data = src.read().astype(np.float32)
        transform = src.transform

    data = clean_nan(data)

    # ✅ DO NOT scale again — Kolleru TIFFs already exported as reflectance (0–1)
    # Uncomment this line ONLY if your TIFFs were raw integer bands (0–10000)
    # data /= 10000.0  

    print("🔹 Using Kolleru normalization (mean/std)...")

    mean = norm_params["mean"].astype(np.float32)
    std = norm_params["std"].astype(np.float32)
    std = np.where(std == 0, 1, std)

    # Same as training
    data = (data - mean) / std
    data = np.clip(data, -3, 3)
    data = (data + 3) / 6

    return data.astype(np.float32), transform


# ===============================================================
# CANAL NORMALIZATION (Robust percentile normalization)
# ===============================================================
def normalize_canal(tif_path, norm_params):
    """Applies robust percentile-based normalization (College Canal model)."""
    with rasterio.open(tif_path) as src:
        data = src.read().astype(np.float32)
        transform = src.transform

    data = clean_nan(data)

    # Handle scaling if exported raw from GEE
    if np.nanmax(data) > 1.0:
        print("⚙️ Scaling Canal input by 10000 (GEE reflectance adjustment).")
        data /= 10000.0

    print("🔹 Using Canal normalization (robust percentile)...")

    normalized = np.zeros_like(data, dtype=np.float32)
    num_bands = int(norm_params.get('num_bands', data.shape[0]))

    for i in range(num_bands):
        band = data[i].copy()

        # Retrieve saved percentile limits safely
        try:
            p_low = float(norm_params[f'band_{i}_p_low'])
            p_high = float(norm_params[f'band_{i}_p_high'])
        except KeyError:
            print(f"⚠️ Missing percentile keys for band {i}, using fallback percentiles.")
            p_low, p_high = np.percentile(band, 2), np.percentile(band, 98)

        # Handle NaNs
        nan_mask = np.isnan(band)
        if nan_mask.any():
            median_val = np.nanmedian(band)
            band[nan_mask] = median_val

        # Clip and normalize to [0, 1]
        if p_high > p_low:
            band = np.clip(band, p_low, p_high)
            normalized[i] = (band - p_low) / (p_high - p_low)
        else:
            normalized[i] = 0.0

    print("✅ Canal normalization applied (identical to training).")
    return normalized.astype(np.float32), transform
