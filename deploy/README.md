# Running FlatRadar unattended

Two systemd user units. User units rather than system ones: this reads a database in a
home directory and serves a page on loopback, so it has no business running as root or
before anyone has logged in.

Both assume the repo is at `~/Desktop/projects/flatradar`. If it lives elsewhere, edit
`WorkingDirectory` in the two `.service` files.

## Install

```bash
mkdir -p ~/.config/systemd/user
cp deploy/*.service deploy/*.timer ~/.config/systemd/user/
systemctl --user daemon-reload

systemctl --user enable --now flatradar-collect.timer   # collect every 15 minutes
systemctl --user enable --now flatradar-api.service     # keep the dashboard's API up
```

Collection stops when you log out unless lingering is on:

```bash
sudo loginctl enable-linger "$USER"
```

## Check on it

```bash
systemctl --user list-timers flatradar-collect.timer   # when it last ran and runs next
systemctl --user status flatradar-collect.service      # how the last round went
journalctl --user -u flatradar-collect.service -n 50   # what it printed
```

A round that fails is left failed on purpose, so `status` shows a problem rather than a
silence. One portal failing does not stop the other, and classification runs either way.

## Run one round by hand

```bash
systemctl --user start flatradar-collect.service
# or, without systemd in the way:
pnpm collect
```

## Stop it

```bash
systemctl --user disable --now flatradar-collect.timer flatradar-api.service
```
