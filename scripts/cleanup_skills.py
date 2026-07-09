import os
import shutil

redundant_folders = [
    ".adal", ".augment", ".bob", ".codebuddy", ".commandcode", ".continue", 
    ".cortex", ".crush", ".factory", ".goose", ".iflow", ".junie", 
    ".kilocode", ".kiro", ".kode", ".mcpjam", ".mux", ".neovate", 
    ".openhands", ".pi", ".pochi", ".qoder", ".qwen", ".roo", 
    ".trae", ".vibe", ".windsurf", ".zencoder"
]

def cleanup():
    print("Starting skills cleanup...")
    for folder in redundant_folders:
        path = os.path.join(os.getcwd(), folder)
        if os.path.exists(path):
            try:
                print(f"Removing {folder}...")
                shutil.rmtree(path)
                print(f"✓ Removed {folder}")
            except Exception as e:
                print(f"✗ Failed to remove {folder}: {e}")
        else:
            print(f"- {folder} not found, skipping.")
    print("Cleanup complete.")

if __name__ == "__main__":
    cleanup()
