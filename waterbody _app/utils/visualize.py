import matplotlib
matplotlib.use('Agg')  # Use non-GUI backend for Flask
import matplotlib.pyplot as plt
def save_prediction_map(pred_map, out_path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.colors as mcolors

    colors = ['#808080', '#0000FF', '#FF0000', '#00FF00']
    cmap = mcolors.ListedColormap(colors)
    plt.figure(figsize=(8, 8))
    plt.imshow(pred_map, cmap=cmap, vmin=0, vmax=3, interpolation='nearest')
    plt.axis('off')
    plt.savefig(out_path, bbox_inches='tight', pad_inches=0)
    plt.close()

