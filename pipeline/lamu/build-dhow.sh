#!/bin/zsh
# The player's dhow, from the download to the game: textures, then the Blender build, then packing.
#   pipeline/lamu/build-dhow.sh            (from anywhere; Blender at /Applications/Blender.app unless BLENDER is set)
set -e
R=${0:a:h}/../..
cd $R
source .cache/tools/env.sh
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
node pipeline/lamu/textures.mjs
$B -b --python pipeline/lamu/dhow.py -- "$PWD/Context/3D Assets/dhow_ver_1.glb" "$PWD/.cache/build" "$PWD/src/world/hull.js" 2>&1 | grep -E "^(TIER|HULL|SMEARS)|Error|Traceback"
node pipeline/lamu/pack-dhow.mjs
