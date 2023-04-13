const Noodl = require("@noodl/noodl-sdk");
const { useRef, useEffect, useState } = require("react");
const THREE = require("three");
const {
  VertexNormalsHelper,
} = require("three/examples/jsm/helpers/VertexNormalsHelper");
const { IfcViewerAPI } = require("web-ifc-viewer");
const { IfcAPI, IFCROOF } = require("web-ifc/web-ifc-api");

const { grahamScan } = require("flo-graham-scan");

// For "takstol" and probably more,
// show vertices and let user pick relevant ones?

const IFCThree = (props) => {
  const containerRef = useRef();
  const viewerRef = useRef();
  const apiRef = useRef();

  const [showFilePicker, setShowFilePicker] = useState(true);

  useEffect(() => {
    const viewer = new IfcViewerAPI({
      container: containerRef.current,
      backgroundColor: new THREE.Color(0xffffff),
    });
    viewerRef.current = viewer;

    const ifcAPI = new IfcAPI();
    apiRef.current = ifcAPI;
    ifcAPI.Init();

    // https://ifcjs.github.io/info/docs/Guide/web-ifc-three/api/#applywebifcconfig
    // async, but do we need to await?
    viewer.IFC.applyWebIfcConfig({
      COORDINATE_TO_ORIGIN: true, // move imported model to origin
      USE_FAST_BOOLS: false, // mandatory for some reason, assuming false is default
    });
    // viewer.axes.setAxes();
    // viewer.grid.setGrid();
    // viewer.clipper.active = true;

    const onMouseMove = () => viewer.IFC.selector.prePickIfcItem();
    const onClick = async () => {
      const result = await viewer.IFC.selector.pickIfcItem(false);
      if (!result) return;
      const { modelID, id } = result;
      // viewer.IFC.selector.highlightIfcItem(true);
      const props = await viewer.IFC.getProperties(modelID, id, true, false);
      console.log(props);
    };
    const onKeyDown = (event) => {
      if (event.code === "KeyC") {
        viewer.IFC.selector.unpickIfcItems();
        viewer.IFC.selector.unHighlightIfcItems();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      viewer.dispose();
    };
  }, []);

  const loadFile = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const viewer = viewerRef.current;
      const ifcAPI = apiRef.current;
      setShowFilePicker(false);

      // const url = URL.createObjectURL(file);
      // const model = await viewer.IFC.loadIfcUrl(url, true);
      const model = await viewer.IFC.loadIfc(file, true);
      // viewer.shadowDropper.renderShadow(model.modelID);

      const scene = viewer.IFC.context.getScene();

      ifcAPI.CreateIfcGuidToExpressIdMapping(model.modelID);

      // export this as a function to be called from UI instead (?)
      const eavesCircumference = await calculateEavesCircumference(
        viewer,
        model,
        scene
      );
      console.log("eavesCircumference: ", eavesCircumference);
      props.eavesCircumference(eavesCircumference);
    }
  };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      {showFilePicker && <input type={"file"} onInput={loadFile} />}
    </div>
  );
};

const IFCThreeNode = Noodl.defineReactNode({
  name: "IFC Three",
  category: "Prodikt",
  getReactComponent() {
    return IFCThree;
  },
  inputProps: {},
  outputProps: {
    // TODO: output dimensions
    eavesCircumference: { type: "number" },
  },
});

Noodl.defineModule({
  reactNodes: [IFCThreeNode],
  nodes: [],
  setup() {},
});

// functions

// TODO: break out some of this logic
async function calculateEavesCircumference(viewer, model, scene) {
  let eavesCircumference = 0;

  const roofElements = await getAllMeshesOfType(viewer, model.modelID, IFCROOF);
  roofElements.forEach((e) => {
    scene.add(e); // debug
    e.position.y += 10;
    // e.geometry.computeBoundingBox();
    // console.log("BoundingBox: ", e.geometry.boundingBox); // v
    // e.geometry.computeVertexNormals();

    // const helper = new VertexNormalsHelper(e, 1, 0xff0000);
    // scene.add(helper);

    // const boxHelper = new THREE.BoxHelper(e, 0xff0000);
    // scene.add(boxHelper);

    // transparent box representing bounding box
    // filter vertices intersecting the box to find vertices relevant to "takfot"
    // might not work with some shapes, letting user pick might be only way?

    // find lowest vertex, then all vertices on same level (only works for flat bottom roof)
    const positionAttribute = e.geometry.getAttribute("position");
    let lowest = Infinity;
    const vertexMap = new Map(); // turns out there's three vertices for each triangle so there are "duplicates"
    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(positionAttribute, i);

      const key = `${vertex.x}:${vertex.y}:${vertex.z}`;
      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertex);
      }

      if (vertex.y < lowest) {
        lowest = vertex.y;
      }
    }

    const vertices = [...vertexMap.values()];

    // TODO: handle non flat bottomed roofs by calculating bounding box
    // and find intersecting vertices
    // then find vertices with same x/z and pick the one with lower z
    const lowestVertices = vertices.filter((vertex) => {
      return vertex.y === lowest;
    });

    const sortedPoints = grahamScan(
      lowestVertices.map((vertex) => [vertex.x, vertex.z])
    );
    if (!sortedPoints) {
      console.log("Could not calculate eaves circumference for roof", e);
    } else {
      const sortedVertices = sortedPoints.map(([x, z]) => {
        return lowestVertices.find((vertex) => {
          return vertex.x === x && vertex.z === z;
        });
      });

      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        ...sortedVertices,
        sortedVertices[0],
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.position.y += 5;
      scene.add(line); // debug

      sortedVertices.forEach((vertex, i, list) => {
        const isLast = i === list.length - 1;
        const next = isLast ? list[0] : list[i + 1];
        const distance = vertex.distanceTo(next);
        eavesCircumference += distance;
        // console.log("distance: ", distance);
      });
    }

    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const geometry = new THREE.SphereGeometry(0.2, 32, 16);
    lowestVertices.forEach((vertex) => {
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.x = vertex.x;
      sphere.position.y = vertex.y + 10;
      sphere.position.z = vertex.z;
      scene.add(sphere); // debug
    });
  });

  return eavesCircumference;
}

// helpers

// - now it creates a full mesh with geometry and materials maybe change to get only geometry
// - maybe add properties from IFC to be able to compare/correlate
// - maybe allow multiple types like IFCWALL, IFCWALLSTANDARDCASE
async function getAllMeshesOfType(viewer, modelID, type) {
  const ids = await viewer.IFC.getAllItemsOfType(0, type, false);
  const customID = "temp-gltf-subset";

  const meshes = [];
  for (const id of ids) {
    const coordinates = [];
    const expressIDs = [];
    const newIndices = [];

    const alreadySaved = new Map();

    const subset = viewer.IFC.loader.ifcManager.createSubset({
      ids: [id],
      modelID,
      removePrevious: true,
      customID,
    });

    // Subsets have their own index, but share the BufferAttributes
    // with the original geometry, so we need to rebuild a new
    // geometry with this index

    const positionAttr = subset.geometry.attributes.position;
    const expressIDAttr = subset.geometry.attributes.expressID;

    const newGroups = subset.geometry.groups.filter(
      (group) => group.count !== 0
    );

    const newMaterials = [];
    const prevMaterials = subset.material;
    let newMaterialIndex = 0;

    newGroups.forEach((group) => {
      newMaterials.push(prevMaterials[group.materialIndex]);
      group.materialIndex = newMaterialIndex++;
    });

    let newIndex = 0;
    for (let i = 0; i < subset.geometry.index.count; i++) {
      const index = subset.geometry.index.array[i];

      if (!alreadySaved.has(index)) {
        coordinates.push(positionAttr.array[3 * index]);
        coordinates.push(positionAttr.array[3 * index + 1]);
        coordinates.push(positionAttr.array[3 * index + 2]);

        expressIDs.push(expressIDAttr.getX(index));
        alreadySaved.set(index, newIndex++);
      }

      const saved = alreadySaved.get(index);
      newIndices.push(saved);
    }

    const geometryToExport = new THREE.BufferGeometry();
    const newVerticesAttr = new THREE.BufferAttribute(
      Float32Array.from(coordinates),
      3
    );
    const newExpressIDAttr = new THREE.BufferAttribute(
      Uint32Array.from(expressIDs),
      1
    );

    geometryToExport.setAttribute("position", newVerticesAttr);
    geometryToExport.setAttribute("expressID", newExpressIDAttr);
    geometryToExport.setIndex(newIndices);
    geometryToExport.groups = newGroups;
    geometryToExport.computeVertexNormals();

    const mesh = new THREE.Mesh(geometryToExport, newMaterials);
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  viewer.IFC.loader.ifcManager.removeSubset(modelID, undefined, customID);
  return meshes;
}
