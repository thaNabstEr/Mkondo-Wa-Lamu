#!/bin/zsh
# The banks' ground, from the TextureCan downloads in Context/3D Assets/ (1K colour and OpenGL normal maps), to the
# game's texture format (public/assets/tex/<id>_c.webp and _n.webp, as Sakura's Poly Haven textures):
#   mud_puddles  ground_0034 "Muddy ground with puddles"            the wet banks at the water's edge
#   mud_leaves   ground_0005 "Wet muddy ground with fallen leaves"   the forest floor under the canopy
#   pipeline/lamu/ground.sh
set -e
R=${0:a:h}/../..
cd $R
source .cache/tools/env.sh
T=.cache/dl/texturecan
mkdir -p $T
A="Context/3D Assets"
pack() { # id zip colour normal
  rm -rf $T/$1 && mkdir -p $T/$1
  unzip -oq "$A/$2" -x '__MACOSX/*' -d $T/$1
  cwebp -quiet -q 82 $T/$1/$3 -o public/assets/tex/$1_c.webp
  cwebp -quiet -q 90 $T/$1/$4 -o public/assets/tex/$1_n.webp
  echo "$1 ok"
}
pack mud_puddles Muddy_ground_with_puddles_texture.zip ground_0034_color_1k.jpg ground_0034_normal_opengl_1k.png
pack mud_leaves Wet_muddy_ground_with_fallen_leavestexture.zip ground_0005_basecolor_1k.jpg ground_0005_normal_opengl_1k.png
