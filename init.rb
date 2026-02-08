$LOAD_PATH.unshift File.expand_path(File.dirname(__FILE__) + '/lib')
require_dependency 'redmine_glightbox/view_layouts_base_html_head_hook'

Redmine::Plugin.register :redmine_glightbox do
  name 'Redmine GLightbox plugin'
  author 'sk-ys'
  description 'A GLightbox integration plugin for Redmine'
  version '0.2.0'
  url 'http://github.com/sk-ys/redmine_glightbox'
  author_url 'http://github.com/sk-ys'
end
