/*
* virtual-dom hook for scrolling to the text annotation.
*/
const Hook = function ScrollTopHook() {};
Hook.prototype.hook = function hook(node) {
  const el = node.querySelector('.current');
  if (el) {
    const box = node.getBoundingClientRect();
    const row = el.getBoundingClientRect();
    const diff = row.top - box.top;
    const list = node;
    list.scrollTop += diff;
  }
};

export default Hook;
