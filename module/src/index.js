const Noodl = require("@noodl/noodl-sdk");

const IFCThree = (props) => {
  return <></>;
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
