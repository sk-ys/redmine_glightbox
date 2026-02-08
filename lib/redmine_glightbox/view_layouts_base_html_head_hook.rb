module RedmineGlightbox
  class ViewLayoutsBaseHtmlHeadHook < Redmine::Hook::ViewListener
    def view_layouts_base_html_head(context)
      controller = context[:controller]
      action = controller.action_name

      if (controller.controller_name == 'issues' && ['show'].include?(action))
        # TODO: Add support for the issues index page
        stylesheet_link_tag('glightbox.min', plugin: 'redmine_glightbox') +
        stylesheet_link_tag('redmine_glightbox', plugin: 'redmine_glightbox') +
        javascript_include_tag('glightbox.min', plugin: 'redmine_glightbox') +
        javascript_include_tag('redmine_glightbox', plugin: 'redmine_glightbox')
      end
    end
  end
end
