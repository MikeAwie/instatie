import BaseElement from '../base.js';

class MyExport extends BaseElement {
  constructor() {
    super('/components/export/template.html', '/components/export/styles.css');
  }
}

customElements.define('my-export', MyExport);
export default MyExport;
