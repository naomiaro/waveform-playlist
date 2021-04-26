var express = require('express');
var router = express.Router();

/* GET track page. */
router.get('/', function(req, res, next) {
  res.render('track', { title: 'Load a track' });
});

module.exports = router;