const Noodl = require("@noodl/noodl-sdk");
const { useRef, useEffect, useState } = require("react");
const { Color } = require("three");
const { IfcViewerAPI } = require("web-ifc-viewer");
const { IfcAPI } = require("web-ifc/web-ifc-api");

const IFCThree = (props) => {
  const containerRef = useRef();
  const viewerRef = useRef();

  const [showFilePicker, setShowFilePicker] = useState(true);

  useEffect(() => {
    // set up viewer
    const viewer = new IfcViewerAPI({
      container: containerRef.current,
      backgroundColor: new Color(0xffffff),
    });
    viewer.axes.setAxes();
    viewer.grid.setGrid();
    viewer.clipper.active = true;
    viewerRef.current = viewer;

    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    // window.onclick = () => viewer.IFC.selector.pickIfcItem(false)
    window.onclick = async () => {
      const { modelID, id } = await viewer.IFC.selector.pickIfcItem(false);
      viewer.IFC.selector.highlightIfcItem(true);
      const props = await viewer.IFC.getProperties(modelID, id, true, false);
      console.log(props);
    };

    window.onkeydown = (event) => {
      if (event.code === "KeyC") {
        viewer.IFC.selector.unpickIfcItems();
        viewer.IFC.selector.unHighlightIfcItems();
      }
    };
  }, []);

  const loadFile = async (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("file: ", file);

      const viewer = viewerRef.current;
      const url = URL.createObjectURL(file);

      // const fileStuff = await fetch(url);
      // const ifcAsText = await fileStuff.text();
      // const ifcapi = new IfcAPI();
      // const ifcData = await loadFileData(ifcAsText, ifcapi);
      // console.log("ifcData: ", ifcData);

      setShowFilePicker(false);
      const model = await viewer.IFC.loadIfcUrl(url, true);
      // viewer.shadowDropper.renderShadow(model.modelID);
      console.log("viewer: ", viewer);

      // const result = await viewer.GLTF.exportIfcFileAsGltf({
      //   ifcFileUrl: url,
      //   splitByFloors: true,
      //   categories: {
      //     walls: [IFCWALL, IFCWALLSTANDARDCASE],
      //     slabs: [IFCSLAB],
      //     windows: [IFCWINDOW],
      //     curtainwalls: [IFCMEMBER, IFCPLATE, IFCCURTAINWALL],
      //     doors: [IFCDOOR],
      //   },
      //   getProperties: true,
      // });

      // console.log("result: ", result);
      // window.myResult = result;
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
  outputProps: {},
});

Noodl.defineModule({
  reactNodes: [IFCThreeNode],
  nodes: [],
  setup() {},
});

// copy pasta

async function loadFileData(ifcAsText, ifcapi) {
  // leftContainer.innerHTML = ifcAsText.replace(/(?:\r\n|\r|\n)/g, "<br>");
  const uint8array = new TextEncoder().encode(ifcAsText);
  const modelID = await OpenIfc(uint8array, ifcapi);
  const allItems = GetAllItems(modelID, ifcapi);
  return JSON.stringify(allItems, undefined, 2);
}

async function OpenIfc(ifcAsText, ifcapi) {
  await ifcapi.Init();
  return ifcapi.OpenModel(ifcAsText);
}

function GetAllItems(modelID, ifcapi, excludeGeometry = false) {
  const allItems = {};
  const lines = ifcapi.GetAllLines(modelID);
  getAllItemsFromLines(modelID, lines, allItems, excludeGeometry, ifcapi);
  return allItems;
}

function getAllItemsFromLines(
  modelID,
  lines,
  allItems,
  excludeGeometry,
  ifcapi
) {
  for (let i = 1; i <= lines.size(); i++) {
    try {
      saveProperties(modelID, lines, allItems, excludeGeometry, i, ifcapi);
    } catch (e) {
      console.log(e);
    }
  }
}

function saveProperties(
  modelID,
  lines,
  allItems,
  excludeGeometry,
  index,
  ifcapi
) {
  const itemID = lines.get(index);
  const props = ifcapi.GetLine(modelID, itemID);
  props.type = props.__proto__.constructor.name;
  if (!excludeGeometry || !geometryTypes.has(props.type)) {
    allItems[itemID] = props;
  }
}

// function getPropertyWithExpressId(modelID = 0) {
//   const prop = document.getElementById("properties");
//   prop.innerHTML = "";
//   table.innerHTML = "";

//   const elementID = parseInt(document.getElementById("expressIDLabel").value);

//   // If third parameter is added as true, we get a flatten result
//   const element = ifcapi.GetLine(modelID, elementID);

//   // Now you can fetch GUID of that Element
//   const guid = element.GlobalId.value;
//   createRowInTable("GUID", guid);

//   const name = element.Name.value;
//   createRowInTable("Name", name);

//   const ifcType = element.__proto__.constructor.name;
//   createRowInTable("IfcType", ifcType);

//   const type = element.ObjectType.value;
//   createRowInTable("Object Type", type);

//   const tag = element.Tag.value;
//   createRowInTable("Tag", tag);

//   // grab all propertyset lines in the file
//   let lines = ifcapi.GetLineIDsWithType(modelID, IFCRELDEFINESBYPROPERTIES);

//   // In the below array we will store the IDs of the Property Sets found
//   let propSetIds = [];
//   for (let i = 0; i < lines.size(); i++) {
//     // Getting the ElementID from Lines
//     let relatedID = lines.get(i);

//     // Getting Element Data using the relatedID
//     let relDefProps = ifcapi.GetLine(modelID, relatedID);

//     // Boolean for Getting the IDs if relevant IDs are present
//     let foundElement = false;

//     // RelatedObjects is a property that is an Array of Objects.
//     // The way IFC is structured, Entities that use same property are included inside RelatedObjects
//     // We Search inside RelatedObjects if our ElementID is present or not
//     relDefProps.RelatedObjects.forEach((relID) => {
//       if (relID.value === elementID) {
//         foundElement = true;
//       }
//     });

//     if (foundElement) {
//       // Relevant IDs are found we then we go to RelatingPropertyDefinition
//       // RelatingPropertyDefinition contain the IDs of Property Sets
//       // But they should not be array, hence using (!Array.isArray())
//       if (!Array.isArray(relDefProps.RelatingPropertyDefinition)) {
//         let handle = relDefProps.RelatingPropertyDefinition;

//         // Storing and pushing the IDs found in propSetIds Array
//         propSetIds.push(handle.value);
//       }
//     }
//   }

//   // Getting the Property Sets from their IDs
//   let propsets = propSetIds.map((id) => ifcapi.GetLine(modelID, id, true));

//   propsets.forEach((set) => {
//     // There can multiple Property Sets
//     set.HasProperties.forEach((p) => {
//       // We will check if the Values that are present are not null
//       if (p.NominalValue != null) {
//         if (p.NominalValue.label === "IFCBOOLEAN") {
//           // We will talk about this function in Frontend Part
//           createRowInTable(p.Name.value, p.NominalValue.value);
//         } else {
//           // We will talk about this function in Frontend Part
//           createRowInTable(p.NominalValue.label, p.NominalValue.value);
//         }
//       }
//     });
//   });

//   prop.appendChild(table);
// }
