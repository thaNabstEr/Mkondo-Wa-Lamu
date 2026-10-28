# Prints what a downloaded model is made of: objects, triangles, bounds, materials and their textures.
#   blender -b --python pipeline/lamu/inspect.py -- <file.glb>
import bpy, sys
from mathutils import Vector

src = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.context.view_layer.update()

lo = Vector((1e9, 1e9, 1e9)); hi = -lo
total = 0
for o in bpy.data.objects:
    if o.type != 'MESH':
        print(f'{o.type:8} {o.name}')
        continue
    me = o.data
    me.calc_loop_triangles()
    tris = len(me.loop_triangles)
    total += tris
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    a = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    b = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    lo = Vector((min(lo.x, a.x), min(lo.y, a.y), min(lo.z, a.z))); hi = Vector((max(hi.x, b.x), max(hi.y, b.y), max(hi.z, b.z)))
    mats = ', '.join(m.name for m in me.materials if m)
    print(f'MESH     {o.name:28} tris {tris:7}  min ({a.x:7.2f},{a.y:7.2f},{a.z:7.2f}) max ({b.x:7.2f},{b.y:7.2f},{b.z:7.2f})  mats [{mats}]')
print(f'TOTAL tris {total}  bounds min ({lo.x:.2f},{lo.y:.2f},{lo.z:.2f}) max ({hi.x:.2f},{hi.y:.2f},{hi.z:.2f})  size ({hi.x-lo.x:.2f},{hi.y-lo.y:.2f},{hi.z-lo.z:.2f}) (Blender: z up)')
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    texs = []
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            link = n.outputs['Color'].links[0].to_socket.name if n.outputs['Color'].links else '-'
            texs.append(f'{n.image.name} {n.image.size[0]}x{n.image.size[1]} -> {link}')
    print(f'MAT {m.name:24} blend {m.surface_render_method if hasattr(m, "surface_render_method") else "?"}  {"; ".join(texs)}')
