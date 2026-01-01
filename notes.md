
# stop and restart
```bash
chuck@node-server:/server/sensor-server$ sudo systemctl daemon-reload && sudo systemctl restart node-sensor
```
### node server commands
 ``` bash
chuck@node-server:~$ sudo systemctl status mongod
chuck@node-server:~$ sudo systemctl status node-prod
chuck@node-server:~$ sudo systemctl status node-sensor
chuck@node-server:~$  sudo systemctl daemon-reload && sudo systemctl restart node-sensor  #restart server
chuck@node-server:~$ sudo journalctl -u node-sensor -f  #live view
chuck@node-server:~$ sudo journalctl -u node-sensor --since "1 hour ago" #jump to a specific time
chuck@node-server:~$ sudo journalctl -u node-sensor -p err..alert  #show only errors
chuck@node-server:~$ sudo journalctl -u node-sensor -g "ESP32_ID_123" #-g grep
chuck@node-server:~$ sudo journalctl -u node-sensor -b -1 #-b -1: Shows logs from the previous boot session. (-b 0 is the current session)
chuck@node-server:~$ sudo journalctl -u mongod -u node-prod -f #follow both at same time
 ```
 journal navigation
 When you are looking at a long log file (not in -f follow mode), it opens in a "pager" (usually less)
G: Jump to the very end of the logs.
g: Jump to the very beginning.
/: Type a word and hit enter to search forward.
q: Quit and go back to the command line.




## versions

### 