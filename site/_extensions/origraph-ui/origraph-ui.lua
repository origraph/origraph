buttonCount = 0

return {
  ['origraph-ui-button'] = function(args, kwargs, meta, raw_args, context)
    -- Code to render a button: {{< origraph-ui-button contents="My Button" >}}
    if quarto.doc.isFormat('html') then
      local containerId = "origraph-ui-button-container-"..buttonCount
      buttonCount = buttonCount + 1

      -- container element, for react to render inside
      local containerTag = 'span'
      if (type(kwargs['containerTag']) == 'string') then
        -- TODO: this override isn't actually used anywhere yet; was trying to use this shortcode in _quarto.yml
        -- for the header buttons, but something more complicated is going on there, that isn't actually the
        -- container (maybe it's the link-within-a-link?)
        containerTag = kwargs['containerTag']
      elseif context=='block' then
        containerTag = 'p'
      end

      -- placeholder markdown for initial page render, until React finishes replacing it
      local placeholderIcon = ''
      if (type(kwargs['placeholderIcon']) == 'string') then
        placeholderIcon = '    <img src="'..kwargs['placeholderIcon']..'" class="origraph-icon" />\n'
      end
      placeholder = '<'..containerTag..' class="origraph-ui-button-container" id="'..containerId..'">\n'
        ..'  <a href="#" class="origraph-button">\n'
        ..placeholderIcon
        ..'    '..kwargs['contents']..'\n'
        ..'  </a>\n'
        ..'</'..containerTag..'>\n'
      
      -- lazy passthrough for jsArgs, because I don't want to mess with lua tables / JSON conversion crap yet
      local jsArgs = ''
      if (type(kwargs['jsArgs']) == 'string') then
        jsArgs = kwargs['jsArgs']
      end

      -- script to render button instead of placeholder
      renderScript = '<script type="application/javascript">\n'
        .."origraph.components.basicUi.renderButton({\n"
        .."  targetElement: document.querySelector('#"..containerId.."'),\n"
        .."  children: '"..kwargs['contents'].."',\n"
        ..jsArgs..'\n'
        .."});\n"
        .."</script>"
      return pandoc.RawBlock('html', placeholder..'\n'..renderScript)
    end
  end
}
