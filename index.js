
import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { radixSort } from './SortUtils.js';

const POINTS_COUNT = 500000;
const ARRAY_SORT = 0;
const HYBRID_RADIX = 1;
const SORT_OPTIONS = { ARRAY_SORT, HYBRID_RADIX };

let gui, infoEl;
let camera, controls, scene, renderer;
let points, material;
let averageTime = 0, timeSamples = 0;

const renderListArray = new Array( POINTS_COUNT ).fill().map( () => ( {} ) );
const auxArray = new Array( POINTS_COUNT );

const _vec = new THREE.Vector3();
const _color = new THREE.Color();
const params = {
    size: 0.25,
    opacity: 0.5,
    sortMode: HYBRID_RADIX,
};

init();
initMesh();
animate();

//

function rand( min, max ) {

    const delta = max - min;
    return min + Math.random() * delta;

}

function initMesh() {

    const posArr = new Float32Array( POINTS_COUNT * 3 );
    const colArr = new Uint8Array( POINTS_COUNT * 3 );
    const indexArr = new Uint32Array( POINTS_COUNT );
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
        depthWrite: false
    } );
    points = new THREE.Points( geometry, material );

    scene.add( points );

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

    gui.add( params, 'size', 0.05, 1, 0.05 ).onChange( v => {

        material.size = v;

    } );
    gui.add( params, 'opacity', 0, 1, 0.01 ).onChange( v => {

        material.needsUpdate = true;
        material.opacity = v;
        if ( v === 1 ) {

            material.transparent = false;
            material.depthWrite = true;

        } else {

            material.transparent = true;
            material.depthWrite = false;

        }

    } );

    infoEl = document.getElementById( 'info' );

    // listeners

    window.addEventListener( 'resize', onWindowResize );

}

//

function sortParticles() {

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
    
    controls.update();

    render();

}

function render() {

    const start = window.performance.now();
    sortParticles();
    const delta = window.performance.now() - start;
    averageTime += ( delta - averageTime ) / ( timeSamples + 1 );
    if ( timeSamples < 60 ) {
        
        timeSamples ++;

    }

    renderer.render( scene, camera );

    infoEl.innerHTML = `points count  : ${ POINTS_COUNT }\n`;
    infoEl.innerHTML += `sort time     : ${ averageTime.toFixed( 2 ) }ms`;

}
