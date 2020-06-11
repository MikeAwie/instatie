import BaseElement from '../base.js';

class MyStiri extends BaseElement {
  constructor() {
    super('/components/stiri/template.html', '/components/stiri/styles.css');
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchData();
  }

  async fetchData() {
    const [data] = await Promise.all([
      fetch('http://localhost:3000/news').then((res) => res.json()),
      this.readyPromise,
    ]);
    const stiriContainer = this._root.querySelector('#stiri-container');
    const bodyDialog = this._root.querySelector('#body-dialog');
    bodyDialog.addEventListener('click', () => this.toggleBodyDialog());
    const modal = this._root.querySelector('.modal');
    data.forEach(({ id, title, date, body }) => {
      const article = document.createElement('article');
      const div = document.createElement('div');
      const h2 = document.createElement('h2');
      h2.textContent = title;
      const button = document.createElement('button');
      button.textContent = 'Citeste mai mult';
      button.addEventListener('click', () => {
        modal.innerHTML = body;
        this.toggleBodyDialog();
      });
      div.appendChild(h2);
      div.append(button);

      article.appendChild(div);
      stiriContainer.appendChild(article);
    });
  }

  toggleBodyDialog(state) {
    const bodyDialog = this._root.querySelector('#body-dialog');
    const shouldShow = typeof state === 'undefined' ? !bodyDialog.className : state;
    bodyDialog.className = shouldShow ? 'active' : '';
  }
}

customElements.define('my-stiri', MyStiri);
export default MyStiri;
