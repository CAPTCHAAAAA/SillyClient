Pod::Spec.new do |s|
  s.name             = 'SillyClientCore'
  s.version          = '1.9.1'
  s.summary          = 'SillyClient iOS Native Core Extensions'
  s.homepage         = 'https://github.com/CAPTCHAAAAA/SillyClient'
  s.license          = 'MIT'
  s.author           = { 'SillyClient' => 'dev@sillyclient.com' }
  s.source           = { :git => 'https://github.com/CAPTCHAAAAA/SillyClient.git' }
  s.platform         = :ios, '14.0'
  s.swift_version    = '5.0'
  s.source_files     = '*.{swift,h,m}'
  s.exclude_files    = 'AppDelegate.swift'
  s.resources        = 'Resources/**/*'
  s.frameworks       = 'UIKit', 'WebKit', 'AVFoundation', 'Security'
  s.dependency 'Capacitor'
end
