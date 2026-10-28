#!/bin/zsh
# The mangrove forest's trees, from the downloads to the game: the black mangrove's leaf sprays (through Sakura's
# atlas pipeline) and the tree grown to carry them, then every species' tiers, then packing.
#   pipeline/lamu/build-mangroves.sh       (from anywhere; Blender at /Applications/Blender.app unless BLENDER is set)
set -e
R=${0:a:h}/../..
cd $R
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
A="$PWD/Context/3D Assets"
O="$PWD/.cache/build"
run() { $B -b --python "$@" 2>&1 | grep -E "^(CLOSED|TREE|BARK|SIZE|TIER|GROUND|KEYED)|Traceback|Error" || true; }
mkdir -p $O/brug
for c in 0 1 2 3; do run pipeline/lamu/bruguiera_sprays.py -- "$A/Mangroove_leaf_and _flower_floaters.glb" $O/brug $c; done
run pipeline/lamu/bruguiera_tree.py -- $O/brug "$A/red-mangrove-tree_single_2.glb" $O/bruguiera_src.glb
run pipeline/lamu/mangrove.py -- red "$A/red-mangrove-tree_single_2.glb" $O
run pipeline/lamu/mangrove.py -- light "$A/mangrove_tree_single.glb" $O
run pipeline/lamu/mangrove.py -- rhizo "$A/Main_mangroove_forest.glb" $O
run pipeline/lamu/mangrove.py -- brug $O/bruguiera_src.glb $O
node pipeline/lamu/pack-mangrove.mjs
