# Micropub AS
Transform any Matrix client into a Micropub client instantly.

## Pre-requisites
 - You need to have a [home server](https://github.com/matrix-org/synapse) installed and running.

## Setup
 - Copy `config.sample.yaml` and edit the URL and token fields. The tokens can be anything you want.
 - Generate a registration file by typing `node app -c your.config.file.yaml --generate-registration`
 - Make your home server aware of the registration file (setting `app_service_config_files` in `homeserver.yaml` to the path of the registration file, remember it's a list so use `["file/path.yaml"]`)
 - Restart your home server.
 - Run the application service: `node app -c your.config.file.yaml`

## Usage
 - Invite `@micropub:yourdomain` to a room. It will automatically join.
 - Type `!indieauth http://yourdomain.com` - it will return an OAuth URL for you to click.
 - Login via IndieAuth.
 - The bot will let you know that you've authorised.
 - Send any message into the room.
 - It will be transformed into a micropub `entry` and sent to your specified micropub endpoint.
