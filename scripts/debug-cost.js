const costRows = [{"label":"24/25","rfcWoDemand":0,"depreciation":0,"adderDemand":0,"baseActual":14.334117499999998,"changeActual":0,"costRtu":81.06365834004835},{"label":"25/26 Q1","rfcWoDemand":0,"depreciation":0,"adderDemand":0,"baseActual":15.607,"changeActual":0,"costRtu":77.74},{"label":"25/26 Q2","rfcWoDemand":0,"depreciation":0,"adderDemand":0,"baseActual":15.133,"changeActual":0,"costRtu":77.74},{"label":"25/26 Q3","rfcWoDemand":0,"depreciation":0,"adderDemand":0,"baseActual":0,"changeActual":0,"costRtu":77.74},{"label":"25/26 Q4","rfcWoDemand":0,"depreciation":0,"adderDemand":0,"baseActual":0,"changeActual":0,"costRtu":77.74},{"label":"26/27","rfcWoDemand":0,"depreciation":0,"adderDemand":0.93356612,"baseActual":0,"changeActual":0,"costRtu":113.69}];
const rtuRows = [{"label":"24/25","baseDemand":0,"adderDemand":184,"baseActual":155.42,"changeActual":0,"rtuTs":0},{"label":"25/26 Q1","baseDemand":0,"adderDemand":169,"baseActual":218.4,"changeActual":0,"rtuTs":0},{"label":"25/26 Q2","baseDemand":0,"adderDemand":169,"baseActual":176.62,"changeActual":0,"rtuTs":0},{"label":"25/26 Q3","baseDemand":0,"adderDemand":169,"baseActual":0,"changeActual":0,"rtuTs":0},{"label":"25/26 Q4","baseDemand":0,"adderDemand":169,"baseActual":0,"changeActual":0,"rtuTs":0},{"label":"26/27","baseDemand":0,"adderDemand":22,"baseActual":0,"changeActual":0,"rtuTs":0}];

function qtrAvgLabel(label) {
  return label.includes(' ') ? label : `${label} Qtr. Avg`;
}

function compute() {
  const out = costRows.map(r => {
    let rfcWo = r.rfcWoDemand;
    if ((!rfcWo || rfcWo === 0) && rtuRows && rtuRows.length) {
      const multiplier = (costRows && costRows.length) ? costRows.reduce((s, x) => s + (x.costRtu ?? 0), 0) : (r.costRtu ?? 0);
      let matching = rtuRows.find(rr => rr.label === r.label);
      if (matching) {
        const rtuTotal = (matching.baseDemand ?? 0) + (matching.adderDemand ?? 0);
        if (rtuTotal !== 0 && multiplier != null) {
          rfcWo = (rtuTotal * multiplier) / 1000;
        }
      } else {
        const alt = rtuRows.find(rr => rr.label === qtrAvgLabel(r.label) || qtrAvgLabel(rr.label) === r.label || rr.label === r.label);
        if (alt) {
          const rtuTotal2 = (alt.baseDemand ?? 0) + (alt.adderDemand ?? 0);
          if (rtuTotal2 !== 0 && multiplier != null) {
            rfcWo = (rtuTotal2 * multiplier) / 1000;
          }
        }
      }
    }
    const demandWithAdder = rfcWo + (r.depreciation ?? 0) + (r.adderDemand ?? 0);
    return { label: r.label, rfcWoDemand: rfcWo, demandWithAdder }; 
  });
  console.log(JSON.stringify(out, null, 2));
}
compute();
