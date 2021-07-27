import Loader from "./Loader";

export default class IdentityLoader extends Loader {
  load() {
    return Promise.resolve(this.src);
  }
}
