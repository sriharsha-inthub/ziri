import os, shutil, subprocess, sys
def run():
    exe = shutil.which("ziri")
    if exe:
        sys.exit(subprocess.call([exe] + sys.argv[1:]))
    npx = shutil.which("npx")
    if npx:
        sys.exit(subprocess.call([npx, "ziri"] + sys.argv[1:]))
    print("Ziri requires Node.js >= 18. Please install Node and npm, then `npm -g install ziri`.")
    sys.exit(1)
if __name__ == "__main__":
    run()
