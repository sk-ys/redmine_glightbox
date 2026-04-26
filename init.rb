# Load the hook here only when eager loading is disabled; in production it is loaded via plugin lib eager loading.
require_relative 'lib/redmine_glightbox/view_layouts_base_html_head_hook' unless Rails.application.config.eager_load

Redmine::Plugin.register :redmine_glightbox do
  name 'Redmine GLightbox plugin'
  author 'sk-ys'
  description 'A GLightbox integration plugin for Redmine'
  version '0.5.0'
  url 'http://github.com/sk-ys/redmine_glightbox'
  author_url 'http://github.com/sk-ys'
end
