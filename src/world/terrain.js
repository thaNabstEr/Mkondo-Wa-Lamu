// The coast's terrain: chunks along the channel, columns dense at the water and stretching out to the haze.
// Shading: sand on the shallows and sandbars, dark silt in the deep, mud on the banks, the mangrove floor (mud and
// fallen leaves) under the forest, and Sakura's meadow, triplanar rock and settled snow where any still show.
import * as THREE from 'three';
import { patch } from '../core/shared.js';


function indexFor(nc, nr) {
  const idx = new Uint32Array((nc - 1) * (nr - 1) * 6);
  let k = 0;
  for (let j = 0; j < nr - 1; j++) {
    for (let i = 0; i < nc - 1; i++) {
      const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c;
      idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
  }
  return idx;
}

export function createTerrain(data, tex) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const S = (id) => tex[id];
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  const uniforms = {
    tGrassC: { value: S('leafy_grass_c') }, tGrassN: { value: S('leafy_grass_n') },
    tTurfC: { value: S('turf_c') }, tTurfN: { value: S('turf_n') },
    tGroundC: { value: S('forrest_ground_01_c') }, tGroundN: { value: S('forrest_ground_01_n') },
    tRockC: { value: S('rock_face_c') }, tRockN: { value: S('rock_face_n') },
    tSandC: { value: S('damp_beach_sand_02_c') }, tSandN: { value: S('damp_beach_sand_02_n') },
    tMudC: { value: S('mud_puddles_c') }, tMudN: { value: S('mud_puddles_n') },
    tLitterC: { value: S('mud_leaves_c') }, tLitterN: { value: S('mud_leaves_n') },
    tLeafC: { value: S('forest_leaves_02_c') },
    tSnowC: { value: S('snow_02_c') }, tSnowN: { value: S('snow_02_n') },
  };
  patch(mat, {
    key: 'terrain',
    snow: 0, // terrain handles its own snow with the snow texture
    wet: 0.6,
    uniforms,
    vertexHead: /* glsl */ `attribute vec2 aAux; varying vec2 vAux; varying vec3 vGN;`,
    fragHead: /* glsl */ `
      varying vec2 vAux; varying vec3 vGN;
      uniform sampler2D tGrassC, tGrassN, tTurfC, tTurfN, tGroundC, tGroundN, tRockC, tRockN, tSandC, tSandN, tMudC, tMudN, tLitterC, tLitterN, tLeafC, tSnowC, tSnowN;
      vec3 sfTerrN; float sfTerrRough;
      vec3 unpackN(vec4 t){ return t.xyz * 2.0 - 1.0; }
    `,
    hooks: {
      vertexPost: /* glsl */ `vAux = aAux; vGN = normalize(mat3(modelMatrix) * objectNormal);`,
      map: /* glsl */ `
      {
        vec3 wp = vSfWP;
        vec3 gN = normalize(vGN);
        float dist = distance(wp, cameraPosition);
        float slope = 1.0 - gN.y;
        float nA = sfNoise(wp.xz * 0.045), nB = sfNoise(wp.xz * 0.23), nC = sfNoise(wp.xz * 0.008);
        float forest = vAux.x;
        float sd = vAux.y;
        float sp = uSeason.x, su = uSeason.y, au = uSeason.z, wi = uSeason.w;

        // weights
        float rockW = smoothstep(0.30, 0.52, slope + (nA - 0.5) * 0.22);
        float bedW = smoothstep(0.12, -0.3, wp.y + (nB - 0.5) * 0.3);
        float shoreW = (1.0 - bedW) * smoothstep(3.6, 0.6, sd + (nB - 0.5) * 2.2) * (1.0 - rockW);
        float groundW = clamp(forest * 1.6 - 0.1 + (nA - 0.5) * 0.4, 0.0, 1.0) * (1.0 - rockW) * (1.0 - bedW) * (1.0 - shoreW);
        float grassW = max(0.0, 1.0 - rockW - bedW - shoreW - groundW);
        // sand: in the channel, wherever its bed shelves up toward the surface (the shallows by the banks, the
        // sandbars on the inside of the bends, their crests just out of the water); the deep bed is dark silt and
        // the banks are mud
        float inCh = smoothstep(0.8, -0.4, sd);
        float sandW = inCh * smoothstep(-1.5, -0.55, wp.y + (nB - 0.5) * 0.5);

        vec2 uv = wp.xz;
        float detail = smoothstep(420.0, 240.0, dist);
        vec3 alb = vec3(0.0);
        vec3 tn = vec3(0.0, 0.0, 1.0);
        float rough = 0.9;

        // far albedo: flat colours so distance costs nothing
        vec3 farGrass = mix(vec3(0.075, 0.1, 0.035), vec3(0.06, 0.085, 0.03), su);
        farGrass = mix(farGrass, vec3(0.16, 0.12, 0.05), au);
        farGrass = mix(farGrass, vec3(0.11, 0.1, 0.075), wi);
        vec3 decid = mix(vec3(0.045, 0.07, 0.03), vec3(0.03, 0.06, 0.022), su);
        decid = mix(decid, mix(vec3(0.2, 0.06, 0.02), vec3(0.2, 0.12, 0.02), nC), au);
        decid = mix(decid, vec3(0.06, 0.055, 0.05), wi);
        // under the mangroves: dim olive litter and seedlings, so a gap in the canopy seen from above is a deeper green,
        // not a hole
        vec3 farForest = mix(vec3(0.045, 0.06, 0.03), decid, smoothstep(0.35, 0.75, nC) * 0.5);
        // a canopy from afar: crowns as soft blobs with darker gaps
        float crowns = sfNoise(wp.xz * 0.33) * 0.6 + sfNoise(wp.xz * 0.9 + 3.0) * 0.4;
        farForest *= 0.7 + 0.6 * smoothstep(0.3, 0.75, crowns);
        vec3 farRock = vec3(0.13, 0.13, 0.12) * (0.8 + 0.4 * nA);
        vec3 farShore = mix(vec3(0.08, 0.068, 0.05), vec3(0.24, 0.21, 0.15), sandW);
        vec3 farCol = farGrass * grassW + farForest * groundW + farRock * rockW + farShore * (bedW + shoreW);
        farCol *= 0.8 + 0.4 * nB;

        if (detail > 0.0) {
          vec2 dx = dFdx(uv), dy = dFdy(uv);
          vec3 c = vec3(0.0); vec3 n = vec3(0.0);
          if (grassW > 0.01) {
            vec2 u1 = uv / 3.4;
            vec3 g = textureGrad(tGrassC, u1, dx / 3.4, dy / 3.4).rgb;
            vec3 g2 = textureGrad(tGrassC, uv / 13.0 + 0.37, dx / 13.0, dy / 13.0).rgb;
            g = mix(g, g2, 0.35);
            // open banks are a living sward (rendered from the same grass as the clumps standing on it), the leafy
            // litter only toward the woods; two scales of the turf so its 2 m tile never shows
            float turfW = smoothstep(0.75, 0.3, forest + (nA - 0.5) * 0.3) * smoothstep(70.0, 30.0, sd);
            vec2 u4 = uv / 2.0, u5 = mat2(0.8, -0.6, 0.6, 0.8) * uv / 6.1 + 0.21;
            // (lifted so that, through the meadow's shading below, the sward matches the clumps standing on it)
            vec3 tf = textureGrad(tTurfC, u4, dx / 2.0, dy / 2.0).rgb * mix(0.85, 1.15, textureGrad(tTurfC, u5, dx / 6.1, dy / 6.1).g * 3.0) * 2.1;
            g = mix(g, tf, turfW);
            // season: fresh spring green, deep summer, straw-gold autumn, dull winter
            float lum = dot(g, vec3(0.3, 0.55, 0.15));
            vec3 gs = g * vec3(1.02, 1.08, 0.8);
            gs = mix(gs, g * vec3(0.82, 0.98, 0.7), su);
            gs = mix(gs, vec3(lum * 1.55, lum * 1.15, lum * 0.5), au);
            gs = mix(gs, vec3(lum * 1.2, lum * 1.08, lum * 0.82), wi);
            // the meadow is never one colour: cool mossy patches, warmer dry ones, bare soil and litter in hollows
            float pn = sfNoise(wp.xz * 0.11 + 5.0) * 0.6 + nB * 0.4;
            float pd = sfNoise(wp.xz * 0.06 - 9.0) * 0.7 + sfNoise(wp.xz * 0.5) * 0.3;
            gs *= mix(vec3(0.62, 0.8, 0.78), vec3(1.0, 0.97, 0.88), smoothstep(0.32, 0.72, pn));
            vec3 soil = textureGrad(tGroundC, uv / 4.0, dx / 4.0, dy / 4.0).rgb * vec3(0.78, 0.7, 0.58);
            gs = mix(gs, soil, smoothstep(0.64, 0.84, pd) * mix(0.75, 0.5, turfW));
            c += gs * (0.46 + 0.3 * nA) * grassW;
            n += mix(unpackN(textureGrad(tGrassN, u1, dx / 3.4, dy / 3.4)), unpackN(textureGrad(tTurfN, u4, dx / 2.0, dy / 2.0)), turfW) * grassW;
          }
          if (groundW > 0.01) {
            // the mangrove floor: wet mud strewn with fallen leaves, two scales so its tile never shows; further off,
            // in the canopy's shade, seedlings and litter make it a dim olive
            vec2 u2 = uv / 3.2, u2b = mat2(0.8, -0.6, 0.6, 0.8) * uv / 9.0 + 0.3;
            vec3 g = textureGrad(tLitterC, u2, dx / 3.2, dy / 3.2).rgb;
            g *= mix(0.85, 1.15, textureGrad(tLitterC, u2b, dx / 9.0, dy / 9.0).g * 2.5);
            float under = clamp(0.2 + 0.5 * smoothstep(15.0, 80.0, dist) + (sfNoise(wp.xz * 0.18 + 4.0) - 0.5) * 0.6, 0.0, 0.85);
            vec3 ug = mix(vec3(0.07, 0.085, 0.035), vec3(0.09, 0.1, 0.045), nB);
            g = mix(g * vec3(0.8, 0.76, 0.68), ug, under);
            c += g * (0.7 + 0.3 * nA) * groundW;
            n += unpackN(textureGrad(tLitterN, u2, dx / 3.2, dy / 3.2)) * groundW;
          }
          if (bedW + shoreW > 0.01) {
            // sand: pale coral sand, damp and rippled by the tide; mud: the banks' grey-brown, with standing puddles
            vec2 u3 = uv / 3.0, u6 = uv / 2.4;
            // (the scan is of dark, wet sand: lifted to the pale coral sand of Lamu's shallows, palest where it has dried
            // on the crests)
            vec3 sand = textureGrad(tSandC, u3, dx / 3.0, dy / 3.0).rgb * vec3(2.2, 2.05, 1.75) * mix(0.8, 1.15, smoothstep(-0.3, 0.25, wp.y));
            sand *= mix(0.9, 1.08, sfNoise(wp.xz * 0.07 + 2.0));
            // (its puddles hold a grey sky: toned to the dark brown-grey mud of the mangrove banks)
            vec3 mud = textureGrad(tMudC, u6, dx / 2.4, dy / 2.4).rgb;
            mud = mix(mud, vec3(dot(mud, vec3(0.33))), 0.4) * vec3(0.62, 0.52, 0.42);
            // the deep bed: silt, darker and greener the deeper it lies
            vec3 silt = mix(mud * 0.8, vec3(0.05, 0.06, 0.04), smoothstep(-0.8, -2.2, wp.y) * 0.6);
            vec3 shore = mix(mud, sand, sandW);
            vec3 bed = mix(silt, sand, sandW);
            c += shore * shoreW + bed * bedW;
            vec3 sn = unpackN(textureGrad(tSandN, u3, dx / 3.0, dy / 3.0)), mn = unpackN(textureGrad(tMudN, u6, dx / 2.4, dy / 2.4));
            n += mix(mn, sn, sandW) * (shoreW + bedW);
            // the mud glistens at the waterline; the sand above it is only damp
            rough = mix(rough, mix(0.4, 0.62, sandW), smoothstep(1.2, 0.0, sd) * shoreW);
          }
          if (rockW > 0.01) {
            // triplanar, skipping projections that barely contribute
            vec3 bw = pow(abs(gN), vec3(4.0)); bw /= dot(bw, vec3(1.0));
            vec3 rc = vec3(0.0); vec3 rn = vec3(0.0);
            float s = 1.0 / 7.0;
            if (bw.x > 0.05) { vec2 t = wp.zy * s; rc += textureGrad(tRockC, t, dFdx(t), dFdy(t)).rgb * bw.x; vec3 q = unpackN(textureGrad(tRockN, t, dFdx(t), dFdy(t))); rn += vec3(0.0, q.y, q.x) * sign(gN.x) * bw.x; }
            if (bw.y > 0.05) { vec2 t = wp.xz * s; rc += textureGrad(tRockC, t, dFdx(t), dFdy(t)).rgb * bw.y; vec3 q = unpackN(textureGrad(tRockN, t, dFdx(t), dFdy(t))); rn += vec3(q.x, 0.0, q.y) * bw.y; }
            if (bw.z > 0.05) { vec2 t = wp.xy * s; rc += textureGrad(tRockC, t, dFdx(t), dFdy(t)).rgb * bw.z; vec3 q = unpackN(textureGrad(tRockN, t, dFdx(t), dFdy(t))); rn += vec3(q.x, q.y, 0.0) * bw.z; }
            // the scanned rock is dark: lift it to a plausible albedo, a little moss in the cracks
            rc *= 1.5;
            // the scan is a warm sandstone; the valley's rock is grey andesite
            float rl = dot(rc, vec3(0.3, 0.59, 0.11));
            rc = mix(rc, vec3(rl) * vec3(0.96, 1.0, 0.97), 0.45);
            rc = mix(rc, vec3(0.06, 0.08, 0.035), smoothstep(0.5, 0.8, nB) * 0.35 * (1.0 - wi));
            c += rc * rockW;
            sfTerrN = rn;
          }
          alb = mix(farCol, c, detail);
          tn = normalize(vec3(n.xy * detail, 1.0));
        } else {
          alb = farCol;
        }

        // snow: covers flat ground first, rock last; the bed stays clear
        float snowK = uSnow * (1.0 - bedW);
        if (snowK > 0.001) {
          float cov = smoothstep(0.62 - 0.4 * snowK, 0.9 - 0.3 * snowK, gN.y + (nB - 0.5) * 0.35) * smoothstep(0.0, 0.4, snowK + nA * 0.4 - 0.2);
          cov *= smoothstep(0.05, 0.6, wp.y);
          vec3 sc = vec3(0.82, 0.86, 0.93);
          if (detail > 0.0) sc = mix(sc, textureGrad(tSnowC, uv / 4.0, dFdx(uv) / 4.0, dFdy(uv) / 4.0).rgb * 1.05, detail);
          alb = mix(alb, sc, cov);
          tn = normalize(mix(tn, vec3(0.0, 0.0, 1.0), cov * 0.6));
          rough = mix(rough, 0.6, cov);
        }
        // the waterline: wet dark band
        float wetLine = smoothstep(0.55, 0.0, wp.y) * (1.0 - bedW);
        alb *= 1.0 - mix(0.35, 0.15, sandW) * wetLine;
        rough = mix(rough, 0.3, wetLine * 0.8);

        diffuseColor.rgb = alb;
        sfTerrRough = rough;
        // world normal from the planar tangent frame
        vec3 T = normalize(vec3(1.0, 0.0, 0.0) - gN * gN.x);
        vec3 B = normalize(vec3(0.0, 0.0, 1.0) - gN * gN.z);
        vec3 wn = normalize(T * tn.x + B * tn.y + gN * tn.z);
        if (rockW > 0.01 && detail > 0.0) wn = normalize(mix(wn, normalize(gN + sfTerrN * 0.9), rockW * detail));
        sfTerrN = wn;
      }`,
      normal: /* glsl */ `normal = normalize((viewMatrix * vec4(sfTerrN, 0.0)).xyz);`,
      preLight: /* glsl */ `roughnessFactor = sfTerrRough; sfNW = sfTerrN;`,
    },
  });

  for (const c of data) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(c.pos, 3));
    geo.setAttribute('aAux', new THREE.BufferAttribute(c.aux, 2));
    geo.setIndex(new THREE.BufferAttribute(indexFor(c.nc, c.nr), 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.castShadow = true;
    m.matrixAutoUpdate = false;
    group.add(m);
  }
  return { group, material: mat };
}
