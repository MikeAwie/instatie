import BaseElement from '../base.js';

class MyStiri extends BaseElement {
  constructor() {
    super('/components/stiri/template.html', '/components/stiri/styles.css');
  }
}

customElements.define('my-stiri', MyStiri);
export default MyStiri;
