import ctypes
import os
import sys


def preload_conda_native_libs() -> None:
    """Prefer ABI-matched conda runtime libraries before native ML imports."""
    # sys.prefix follows the active interpreter; CONDA_PREFIX may still point at base.
    conda_prefix = sys.prefix or os.environ.get("CONDA_PREFIX")
    lib_dir = os.path.join(conda_prefix, "lib")
    if not os.path.isdir(lib_dir):
        return

    library_paths = [
        os.path.join(lib_dir, library_name)
        for library_name in ("libstdc++.so.6", "libjpeg.so.8")
    ]
    library_paths = [path for path in library_paths if os.path.exists(path)]

    current_preload = [
        path for path in os.environ.get("LD_PRELOAD", "").split(":") if path
    ]
    preload_paths = library_paths + [
        path for path in current_preload if path not in library_paths
    ]
    if preload_paths:
        os.environ["LD_PRELOAD"] = ":".join(preload_paths)

    for library_path in library_paths:
        ctypes.CDLL(library_path, mode=ctypes.RTLD_GLOBAL)
