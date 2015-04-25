module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        stripBanners: true,
        banner: '/*! <%= pkg.name %> <%= pkg.version %>\n'
          + 'Written by: <%= pkg.author %>\n'
          + 'Website: <%= pkg.website %>\n'
          + 'License: <%= pkg.license %> */\n'
      },
      dist: {
        src: [
          'js/waveform/mixins/*.js',
          'js/waveform/*.js'
        ],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= concat.options.banner %>'
      },
      build: {
        src: '<%= concat.dist.dest %>',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default task(s).
  grunt.registerTask('default', ['concat', 'uglify']);

};