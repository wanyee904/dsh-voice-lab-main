import os
import sys
import zipfile


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: zip_dir.py <src-dir> <out.zip>")
    src, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src):
            dirs.sort()
            files.sort()
            for name in files:
                path = os.path.join(root, name)
                rel = os.path.relpath(path, src).replace(os.sep, "/")
                z.write(path, rel)
    print(out)


if __name__ == "__main__":
    main()
