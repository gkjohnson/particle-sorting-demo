
import * as THREE from 'three';
import { MeshBVH, MeshBVHVisualizer, CENTER } from 'three-mesh-bvh';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { radixSort } from './SortUtils.js';

const POINTS_COUNT = parseInt( window.location.hash.replace( /^#/, '' ) ) || 500000; 
const NONE = - 1;
const ARRAY_SORT = 0;
const HYBRID_RADIX = 1;
const BVH_SORT = 2;
const SORT_OPTIONS = { NONE, ARRAY_SORT, HYBRID_RADIX, BVH_SORT };

let gui, infoEl;
let camera, controls, scene, renderer;
let points, material, bvh, helper;
let clock = new THREE.Clock();
let averageTime = 0, timeSamples = 0;

const renderListArray = new Array( POINTS_COUNT ).fill().map( () => ( {} ) );
const auxArray = new Array( POINTS_COUNT );

const _vec2 = new THREE.Vector2();
const _vec = new THREE.Vector3();
const _color = new THREE.Color();
const params = {
    size: 1,
    opacity: 0.5,
    sortMode: BVH_SORT,

    helperDisplay: false,
    helperDepth: 4,
};

init();
initMesh();
animate();

//

function generateTexture() {

    const size = 256;
    const data = new Uint8Array( size * size * 4 );

    for ( let x = 0; x < size; x ++ ) {

        for ( let y = 0; y < size; y ++ ) {

            _vec2.set( ( 2 * x / size ) - 1, ( 2 * y / size ) - 1 );

            let dist = 1.0 - Math.min( _vec2.length(), 1 );
            dist = dist > 0 ? 1 : 0;

            const i = y * size + x;
            data[ 4 * i + 0 ] = 255;
            data[ 4 * i + 1 ] = 255;
            data[ 4 * i + 2 ] = 255;
            data[ 4 * i + 3 ] = dist * 255;

        }

    }

    const tex = new THREE.DataTexture(
        data,
        size,
        size,
        THREE.RGBAFormat,
        THREE.UnsignedByteType,
        THREE.UVMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.LinearFilter,
        THREE.LinearMipMapLinearFilter,
    );
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;

}

function rand( min, max ) {

    const delta = max - min;
    return min + Math.random() * delta;

}

function initMesh() {

    const posArr = new Float32Array( POINTS_COUNT * 3 );
    const colArr = new Uint8Array( POINTS_COUNT * 3 );
    const indexArr = new Uint32Array( POINTS_COUNT );
    const bvhIndexArr = new Uint32Array( POINTS_COUNT * 3 );
    for ( let i = 0; i < POINTS_COUNT; i ++ ) {

        _vec.randomDirection().multiplyScalar( Math.cbrt( rand( 0, 1 ) ) * 40 );
        _color.setHSL( rand( 0, 1 ), rand( 0.8, 1 ), rand( 0.3, 0.4 ) );

        posArr[ 3 * i + 0 ] = _vec.x;
        posArr[ 3 * i + 1 ] = _vec.y;
        posArr[ 3 * i + 2 ] = _vec.z;

        colArr[ 3 * i + 0 ] = _color.r * 255;
        colArr[ 3 * i + 1 ] = _color.g * 255;
        colArr[ 3 * i + 2 ] = _color.b * 255;

        indexArr[ i ] = i;

        bvhIndexArr[ 3 * i + 0 ] = i;
        bvhIndexArr[ 3 * i + 1 ] = i;
        bvhIndexArr[ 3 * i + 2 ] = i;

    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.BufferAttribute( posArr, 3, false ) );
    geometry.setAttribute( 'color', new THREE.BufferAttribute( colArr, 3, true ) );
    geometry.setIndex( new THREE.BufferAttribute( indexArr, 1, false ) );

    material = new THREE.PointsMaterial( {
        vertexColors: true,
        size: 1,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        map: generateTexture(),
    } );
    points = new THREE.Points( geometry, material );

    const bvhGeometry = new THREE.BufferGeometry();
    bvhGeometry.setAttribute( 'position', new THREE.BufferAttribute( posArr, 3, false ) );
    bvhGeometry.setIndex( new THREE.BufferAttribute( bvhIndexArr, 1, false ) );

    bvh = new MeshBVH( bvhGeometry, { splitStrategy: CENTER, maxLeafTris: 1 } );

    const bvhMesh = new THREE.Mesh();
    bvhMesh.geometry.boundsTree = bvh;

    scene.add( points );

    const helperMesh = new THREE.Mesh();
    helperMesh.geometry.boundsTree = bvh;
    
    helper = new MeshBVHVisualizer( helperMesh, params.helperDepth );
    helper.update();
    scene.add( helper );

}

function init() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    // camera

    camera = new THREE.PerspectiveCamera( 70, width / height, 1, 500 );
    camera.position.set( 50, 30, 30 ).multiplyScalar( 1.25 );

    // renderer

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( width, height );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild( renderer.domElement );

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x182122 );

    // controls

    controls = new OrbitControls( camera, renderer.domElement );
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;

    // gui

    gui = new GUI();
    gui.add( params, 'sortMode', SORT_OPTIONS ).onChange( () => {

        timeSamples = 0;

    } );

    gui.add( params, 'size', 0.05, 2, 0.05 ).onChange( v => {

        material.size = v;

    } );

    gui.add( params, 'opacity', 0, 1, 0.01 ).onChange( v => {

        material.opacity = v;

    } );

    gui.add( params, 'helperDisplay' );

    gui.add( params, 'helperDepth', 1, 25, 1 ).onChange( v => {

        helper.depth = v;
        helper.update();

    } );

    infoEl = document.getElementById( 'info' );

    // listeners

    window.addEventListener( 'resize', onWindowResize );

    window.addEventListener( 'hashchange', () => {

        window.location.reload();

    } );

}

//

function sortParticles() {

    camera.updateMatrixWorld();

    if ( params.sortMode === ARRAY_SORT ) {

        const posAttr = points.geometry.attributes.position;
        const indexAttr = points.geometry.index;
        for ( let i = 0; i < POINTS_COUNT; i ++ ) {

            const info = renderListArray[ i ];
            info.index = i;
            info.z = _vec.fromBufferAttribute( posAttr, i ).distanceToSquared( camera.position );

        }

        renderListArray.sort( ( a, b ) => b.z - a.z );
        for ( let i = 0; i < POINTS_COUNT; i ++ ) {

            const info = renderListArray[ i ];
            indexAttr.setX( i, info.index );

        }
        indexAttr.needsUpdate = true;

    } else if ( params.sortMode === HYBRID_RADIX ) {

        const posAttr = points.geometry.attributes.position;
        const indexAttr = points.geometry.index;
        for ( let i = 0; i < POINTS_COUNT; i ++ ) {

            const info = renderListArray[ i ];
            info.index = i;
            info.z = _vec.fromBufferAttribute( posAttr, i ).distanceToSquared( camera.position );

        }

        radixSort( renderListArray, {
            get: el => el.z,
            aux: auxArray,
            reversed: true,
        } );

        for ( let i = 0; i < POINTS_COUNT; i ++ ) {

            const info = renderListArray[ i ];
            indexAttr.setX( i, info.index );

        }
        indexAttr.needsUpdate = true;

    } else if ( params.sortMode === BVH_SORT ) {

        const cameraPos = camera.position;
        const indexAttr = points.geometry.index;
        const bvhIndexAttr = bvh.geometry.index;
        const xyzFields = [ 'x', 'y', 'z' ];
        let currIndex = 0;

        bvh.shapecast( {

            boundsTraverseOrder: ( box, splitAxis, isLeftNode ) => {

                const field = xyzFields[ splitAxis ];
                const cameraValue = cameraPos[ field ];
                const planeValue = isLeftNode ? box.max[ field ] : box.min[ field ];
                const isCameraOnLeft = cameraValue < planeValue;
                return Number( isCameraOnLeft === isLeftNode );
 
            },
            intersectsBounds: () => true,
            intersectsRange: tri => {

                indexAttr.setX( currIndex, bvhIndexAttr.getX( tri * 3 ) );
                currIndex ++;

            },

        } );

        indexAttr.needsUpdate = true;

    }


}

function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize( width, height );

}

function animate() {

    requestAnimationFrame( animate );
    
    controls.update( clock.getDelta() );

    render();

}

function render() {

    helper.visible = params.helperDisplay;

    const start = window.performance.now();
    sortParticles();
    const delta = window.performance.now() - start;
    averageTime += ( delta - averageTime ) / ( timeSamples + 1 );
    if ( timeSamples < 120 ) {
        
        timeSamples ++;

    }

    material.size = params.size;
    material.opacity = params.opacity;
    renderer.render( scene, camera );

    infoEl.innerHTML = `points count  : ${ POINTS_COUNT }\n`;
    infoEl.innerHTML += `sort time     : ${ averageTime.toFixed( 2 ) }ms`;

}
