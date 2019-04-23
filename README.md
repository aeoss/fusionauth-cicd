
# FusionAuth CI/CD

> This is a very early release. We make no guarantees that this will work as expected. We anticipate bugs. Send us issues!

This application, powered by Node.js, allows you to hold FusionAuth configuration settings within your CI/CD process. This might include using Git or SVN to version-control configuration, login UI templates, or email templates. Anything that can be configured from the `Settings > System` page within FusionAuth can be configured via Yaml within a data directory of your CI/CD process.

How you structure your template and configuration files is partially up to you. The CI/CD container will expect *.ftl files to be named according to the conguration object's key that they should apply to. For a better example of this, see the [aeoss/fusionauth-cicd-example](https://github.com/aeoss/fusionauth-cicd-example) repository.
