# Leaf sprays for the black mangrove (Bruguiera gymnorhiza), through Sakura's atlas pipeline (pipeline/veg/atlaslib.py),
# from the ffish.asia / floraZia CC0 scan (Context/3D Assets/Mangroove_leaf_and _flower_floaters.glb). The scan is not
# a tree: it is two single leaves and two flowers (each at several levels of detail) beside a 1 cm colour checker. As
# Sakura does with its oak and maple scans, the real leaves are laid out into sprays on a twig and rendered into
# atlas cells (colour, ambient occlusion, normal); pipeline/lamu/bruguiera_tree.py then grows a tree to carry them.
#
#   blender -b --python pipeline/lamu/bruguiera_sprays.py -- <src.glb> <out-dir> <cell 0-3>
# Cells 0-2: leafy shoots (the leaves crowd the shoot tips in opposite pairs, as Bruguiera's do); cell 3: a shoot
# with its red-calyxed flowers. Each cell is 0.5 m square at 1024 px; the twig enters at the left edge, halfway up.
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'veg'))
from atlaslib import *

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, CELL = argv[0], argv[1], int(argv[2])
R = random.Random(4100 + CELL * 17)
EXT = 0.5
reset()

# ---------------------------------------------------------------- the scan's parts, at their finest detail
bpy.ops.import_scene.gltf(filepath=SRC)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in objs:
    o.data.transform(o.matrix_world)
for o in objs:
    o.parent = None; o.matrix_world = Matrix.Identity(4)
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)
# the checker is 1 cm across: it gives the scale in metres
ck = next(o for o in objs if o.data.materials[0].name.startswith('Material.001'))
cv = verts(ck)
K = 0.01 / float((cv.max(axis=0) - cv.min(axis=0)).max())
finest = {}
for o in objs:
    if o is ck: continue
    m = o.data.materials[0].name
    if m not in finest or len(o.data.polygons) > len(finest[m].data.polygons):
        finest[m] = o
for o in objs:
    if o not in finest.values(): bpy.data.objects.remove(o)
print('SCALE', round(K, 4), 'parts', sorted(finest))


def lay_flat(o):
    """foot (the petiole's or stalk's end) to the origin, pointing along +x, the blade's face up (+z)"""
    o.data.transform(Matrix.Scale(K, 4))
    v = verts(o)
    c = v.mean(axis=0)
    w, V = np.linalg.eigh(np.cov((v - c).T))
    ax, nrm = V[:, 2], V[:, 0]
    t = (v - c) @ ax
    L = t.max() - t.min()
    # the petiole end is the thin one: across the last tenth of its length, the stalk is far narrower than the blade
    def width(sel):
        p = v[sel] - c
        return float(np.ptp(p @ V[:, 1])) if sel.any() else 0.0
    lo_w, hi_w = width(t < t.min() + 0.1 * L), width(t > t.max() - 0.1 * L)
    if hi_w < lo_w: ax = -ax; t = -t
    foot = c + ax * t.min()
    # +x along the leaf, +z out of its face (toward the side the scan's colour faces: the upper side is darker and
    # glossier, which the render's lift keeps; either way round the silhouette is the same)
    x = Vector(ax).normalized()
    z = Vector(nrm).normalized()
    z = (z - x * z.dot(x)).normalized()
    y = z.cross(x)
    M = Matrix((x, y, z)).to_4x4() @ Matrix.Translation(-Vector(foot))
    o.data.transform(M)
    o.data.update()
    o.hide_render = True
    return o, L


leaves = [lay_flat(finest[m]) for m in sorted(finest) if 'leaf' in m]
flowers = [lay_flat(finest[m]) for m in sorted(finest) if 'flower' in m]
for o, L in leaves + flowers:
    print('PART', o.name, 'length', round(L, 3))

root = bpy.data.objects.new('root', None)
bpy.context.scene.collection.objects.link(root)


def put(src, p, ang, s, tilt=0.0):
    """a copy of a leaf or flower at p, pointing at angle ang in the spray's plane, tipped up or down by tilt"""
    q = Quaternion((0, 0, 1), ang) @ Quaternion((0, 1, 0), -tilt) @ Quaternion((1, 0, 0), R.uniform(-0.35, 0.35))
    c = inst(src, p, q, s)
    c.hide_render = False
    c.parent = root
    return c


# ---------------------------------------------------------------- the shoot, built lying flat (leaves up, +z)
# a twig along +x from the cell's left edge; its last few nodes carry opposite pairs of leaves, each pair turned a
# quarter-turn from the one below (seen from above, alternate pairs splay sideways and point up or down the frame)
p0 = Vector((-EXT / 2 + 0.01, 0, 0))
main = [p0]
d = Vector((1, 0, 0))
n_seg = 7
for i in range(n_seg):
    d = (d + Vector((0, R.uniform(-0.12, 0.12), 0))).normalized()
    main.append(main[-1] + d * (0.05 if i < 3 else 0.028))
tw = twig(main, 0.0055, 0.003, (0.16, 0.12, 0.09))
tw.parent = root
for i in range(3, n_seg + 1):
    a = math.atan2((main[i] - main[i - 1]).y, (main[i] - main[i - 1]).x)
    spread = R.uniform(0.55, 1.0) if (i % 2) else R.uniform(0.25, 0.55)
    s = R.uniform(1.0, 1.3) * (0.85 + 0.05 * (n_seg - i))
    for side in (-1, 1):
        src, _ = R.choice(leaves)
        put(src, main[i], a + side * spread, s * R.uniform(0.9, 1.1), tilt=R.uniform(-0.15, 0.3))
# the terminal bud's last pair, leaning forward
a = math.atan2(d.y, d.x)
for side in (-1, 1):
    put(R.choice(leaves)[0], main[-1], a + side * R.uniform(0.15, 0.35), R.uniform(0.85, 1.05), tilt=0.1)
if CELL == 3:
    # flowers hang from the leaf axils just behind the tip
    for i in (n_seg - 2, n_seg - 1, n_seg - 3):
        a = math.atan2((main[i] - main[i - 1]).y, (main[i] - main[i - 1]).x)
        put(R.choice(flowers)[0], main[i] + Vector((0, 0, 0.01)), a + R.choice((-1, 1)) * R.uniform(1.1, 1.6), R.uniform(1.1, 1.3), tilt=-0.2)
# seen from above: the flat spray stood up to face the camera (+z becomes -y, toward it)
root.rotation_euler = (math.pi / 2, 0, 0)
render(OUT, CELL, EXT, EXT, 1024, 1024, cx=0.0, bottom=-EXT / 2, ao_dist=0.02, lift=1.15, wb=(1.0, 1.0, 1.0), ao_k=0.3)

# the scanned leaves are riddled with small holes where the photogrammetry found no surface (the meshes are full of
# open edges): closed in the image, a dilation then an erosion of the cut-out, the colour already bled into the gaps
def shift_max(a, r):
    for _ in range(r):
        b = a.copy()
        b[1:] = np.maximum(b[1:], a[:-1]); b[:-1] = np.maximum(b[:-1], a[1:])
        b[:, 1:] = np.maximum(b[:, 1:], a[:, :-1]); b[:, :-1] = np.maximum(b[:, :-1], a[:, 1:])
        a = b
    return a
CLOSE = 10
for f in (f'{OUT}/c{CELL}.png',):
    cfg = oiio.ImageSpec(); cfg.attribute('oiio:UnassociatedAlpha', 1)  # the colour as written, not premultiplied
    px = oiio.ImageBuf(f, 0, 0, cfg).get_pixels(oiio.FLOAT)
    a = px[..., 3]
    closed = 1 - shift_max(1 - shift_max(a, CLOSE), CLOSE)
    px[..., 3] = np.maximum(a, closed)
    spec = oiio.ImageSpec(px.shape[1], px.shape[0], 4, oiio.UINT8); spec.attribute('oiio:UnassociatedAlpha', 1)
    b = oiio.ImageBuf(spec)
    b.set_pixels(oiio.ROI(0, px.shape[1], 0, px.shape[0], 0, 1, 0, 4), np.ascontiguousarray(px))
    b.write(f)
    print('CLOSED', CELL, 'coverage', round(float(a.mean()), 3), '->', round(float(px[..., 3].mean()), 3))
print('BASE', CELL, round((p0.x + EXT / 2) / EXT, 4), 0.5)
