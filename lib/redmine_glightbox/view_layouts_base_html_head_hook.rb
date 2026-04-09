module RedmineGlightbox
  class ViewLayoutsBaseHtmlHeadHook < Redmine::Hook::ViewListener
    ALLOWED_CONTROLLER_ACTIONS = {
      'issues' => %w[show index],
      'issue_note_list' => %w[index],
      'wiki' => %w[show],
      'news' => %w[show index],
      'messages' => %w[show],
      'documents' => %w[show index],
      'files' => %w[index]
    }.freeze

    def view_layouts_base_html_head(context)
      controller = context[:controller]
      return unless include_glightbox_assets?(controller)

      stylesheet_link_tag('glightbox.min', plugin: 'redmine_glightbox') +
      stylesheet_link_tag('redmine_glightbox', plugin: 'redmine_glightbox') +
      javascript_include_tag('glightbox.min', plugin: 'redmine_glightbox') +
      javascript_include_tag('redmine_glightbox', plugin: 'redmine_glightbox')
    end

    private

    def include_glightbox_assets?(controller)
      return false unless controller

      actions = ALLOWED_CONTROLLER_ACTIONS[controller.controller_name]
      actions&.include?(controller.action_name)
    end
  end
end
