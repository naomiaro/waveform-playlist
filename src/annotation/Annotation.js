import uuid from 'uuid';

export default class {
  constructor(id = uuid.v4(), start = 0, end = 0, lines = [], lang = 'en') {
    this.id = id;
    this.start = start;
    this.end = end;
    this.lines = lines;
    this.lang = lang;
  }
}
